/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("D"));

var time = 0;

setInterval(function(){time += 0.1}, 100);

rfid.on('connected', function (version) {
  console.log("Ready to read RFID card");
  rfid.accessMem();

  
  // rfid.on('data', function (uid) {
  //   console.log('\nRFID read UID:\n', time, '\n');
  //   for (var i = 0; i < uid.length; i++) {
  //     console.log('\t', i, '\t', uid[i], '\t', uid[i].toString(16));
  //   }
  // });
});