var amqp = require("amqplib/callback_api");
var dotenv = require("dotenv");
dotenv.config();
console.log("AMQP address:", process.env.MQ_IP);
module.exports = (callback) => {
  amqp.connect(process.env.MQ_IP, (error, conection) => {
    if (error) {
      throw new Error(error);
    }

    callback(conection);
  });
};
