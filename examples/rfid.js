/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("A"));

rfid.on('connected', function () {
  console.log("Ready to read RFID card");
  rfid.on('data', function (uid) {
    console.log(uid);
  });
});