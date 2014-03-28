/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("D"));

rfid.on('connected', function (version) {
  console.log("Ready to read RFID card");
  // rfid.accessMem();
  rfid.on('data', function (uid) {
    console.log('\nRFID read UID:');
    for (var i = 0; i < uid.length; i++) {
      console.log('\t', i, '\t', uid[i], '\t', uid[i].toString(16));
    }
  });
});