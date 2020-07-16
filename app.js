var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var rabbitMQHandler = require("./connection");
var path = require("path");

var app = express();
var router = express.Router();
var server = require("http").Server(app);
var multer = require("multer");
var storage = multer.memoryStorage();
var upload = multer({ dest: "uploads/" });

var crypto = require("crypto");

var CircularJSON = require("circular-json");
const { isUndefined } = require("util");

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

let results = [];

app.use(cors());
app.use(bodyParser.json({ extended: true, limit: "3mb" }));
app.use("/static", express.static(path.join(__dirname, "src", "uploads")));
app.use("/api", router);

app.post("/api/infer", upload.single("image"), (req, res, err) => {
  try {
    // upload(req, res, err => {
    //   console.error('Upload Error:', err)
    //   throw err
    // })
    const id = crypto.randomBytes(20).toString("hex");
    rabbitMQHandler((connection) => {
      connection.createChannel((err, channel) => {
        if (err) {
          throw new Error(err);
        }
        var ex = "infer";

        // const { socket, ...rest } = req
        // for (const key in rest) console.log(key)

        var msg = CircularJSON.stringify({ task: req.body, id });

        console.log("Adding", msg.slice(0, 1000));

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

router.route("/set-result").post(upload.none(), (req, res) => {
  console.log("Setting result", res.body);
  try {
    results.push({
      id: req.body.id,
      result: req.body.result,
      time: new Date(),
    });
    res.status(200).send({
      message: "success",
    });
  } catch (e) {
    res.status(400).send({
      message: e,
    });
  }
});

router.route("/get-all-results").get(upload.none(), (req, res) => {
  res.status(200).send({
    message: "success",
    results: results,
  });
});

router.route("/get-results").get(upload.none(), (req, res) => {
  try {
    var el = results.reverse().find((el) => el.id === req.query.id);
    var intvId = -1;
    console.log(results);
    res.writeHead(200, {
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });

    res.flushHeaders();
    let ct = 0;
    intvId = setInterval(() => {
      if (intvId === -1) return;
      console.log("Intv", el);
      console.log(intvId, req.query.id);
      ct += 1;
      if (ct > 5) {
        console.log("Drop request:", req.query.id);
        clearInterval(intvId);
        throw "Request Timeout";
      }
      if (!isUndefined(el)) {
        res.write(
          `data: ${JSON.stringify({
            message: "success",
            result: {
              id: req.query.id,
              confidence: el.result,
            },
          })}\n\n`
        );

        clearInterval(intvId);
        intvId = -1;
      }
      el = results.reverse().find((el) => el.id === req.query.id);
    }, 3000);
  } catch (e) {
    res.status(400).send({
      message: e,
    });
  }
});

clearResults = () => {
  setTimeout(() => {
    const tmpList = results.filter((el) => (new Date() - el.time) / 10000 > 30);
    results = tmpList;
    return clearResults();
  }, 30000);
};

clearResults();

server.listen(5555, "0.0.0.0", () => {
  console.log("Running at at localhost:5555");
});
