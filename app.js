var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var rabbitMQHandler = require("./connection");
var path = require("path");
var Redis = require("ioredis");
var dotenv = require("dotenv");
var morgan = require("morgan");
dotenv.config();

var app = express();
var router = express.Router();
var server = require("http").Server(app);
var multer = require("multer");
var storage = multer.memoryStorage();
var upload = multer({ dest: "uploads/" });

var crypto = require("crypto");

var CircularJSON = require("circular-json");
const { isUndefined, isNull } = require("util");
const { exception } = require("console");
const { SSL_OP_EPHEMERAL_RSA } = require("constants");
const redis = new Redis(6379, process.env.REDIS_IP);

rabbitMQHandler((connection) => {
  try {
    connection.createChannel((err, channel) => {
      if (err) {
        throw new Error(err);
      }
    });
  } catch (e) {
    console.error("Can't connect to message queue", e);
  }
});

app.use(cors());
app.use(morgan("combined"));
app.use(bodyParser.json({ extended: true, limit: "3mb" }));
app.use("/static", express.static(path.join(__dirname, "src", "uploads")));

app.get("/health", upload.none(), (req, res) => {
  res.status(200).send({
    message: "OK",
  });
});

app.post("/infer", upload.single("image"), (req, res, err) => {
  try {
    const id = crypto.randomBytes(20).toString("hex");
    rabbitMQHandler((connection) => {
      connection.createChannel((err, channel) => {
        if (err) {
          throw new Error(err);
        }
        var ex = "infer";
        var msg = CircularJSON.stringify({ task: req.body, id });

        // console.log("Adding", msg.slice(0, 1000));

        channel.assertQueue(ex, { durable: true });
        channel.sendToQueue(ex, Buffer.from(msg), {
          noAck: false,
          persistent: true,
        });

        channel.close(() => {
          connection.close();
        });

        // setTimeout(function () {
        //   if (connection && connection.isOpen()) connection.close()
        // }, 10000)
      });
    });
    res.status(200).send({
      message: "success",
      id,
    });
  } catch (e) {
    console.error(e);
    res.status(400).send({
      message: e,
    });
  }
});

// app.use(bodyParser.json({ extended: true, limit: '3mb' }))

app.post("/set-result", upload.none(), async (req, res) => {
  console.log("Setting result for", req.body.id);
  console.log("Setting result", req.body.result);
  try {
    const result = await redis.set(req.body.id, req.body.result);
    res.status(200).send({
      message: result,
    });
  } catch (e) {
    console.error(e);
    res.status(400).send({
      message: e,
    });
  }
});

getResult = async (id) => {
  console.log("Getting result for", id);
  var ret = undefined;
  await redis.get(id, (err, result) => {
    if (err || isNull(result)) {
      console.error("Error getting result:", err);
      return ret;
    }
    console.log("Got", result);
    ret = result;
  });

  return ret;
};

sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

app.get("/get-results", upload.none(), async (req, res) => {
  let ct = 0;

  while (ct < 5) {
    result = await getResult(req.query.id);
    if (!isUndefined(result)) {
      console.log("Sending back result", result);
      res.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      res.flushHeaders();
      res.write(
        `data: ${JSON.stringify({
          message: "success",
          result: {
            id: req.query.id,
            confidence: result,
          },
        })}\n\n`
      );
      return;
    } else {
      console.error(`Tried ${ct} times of 5 times`);
      ct += 1;
      await sleep(3000);
    }
  }
  if (ct >= 5)
    res.status(400).send({
      message: "Error getting result for image id:" + req.query.id,
    });
});

server.listen(5555, "0.0.0.0", () => {
  console.log("Running at localhost:5555");
});
