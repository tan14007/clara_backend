var express = require("express");
var router = express.Router();

router.get("/", (req, res) => {
  res.statusCode = 200;
  res.send({
    status:
      "OKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKKOKKKKK",
  });

  // res.statusCode(505);
});
router.post("/", function (req, res) {
  const { data } = axios.post(
    "localhost:8080/v1/annotation?model=clara_covid_test",
    req,
    {
      headers: {
        accept: "multipart/form-data",
        "Content-Type": "multipart/form-data",
        params: {},
      },
    }
  );
  console.log(req);
  res.send(data);
});

module.exports = router;
