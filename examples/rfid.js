/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("A"));

rfid.on('connected', function (version) {
  console.log("Ready to read RFID card");
  // rfid.accessMem();
  rfid.on('data', function (uid) {
    console.log(uid);
  });
});