/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("D"));

var time = 0;

setInterval(function(){time += 0.1}, 100);

rfid.on('connected', function (version) {
  console.log("\n\n\t\tReady to read RFID card\n\n");
  rfid.accessMem();

  // // var cmd1 = new Buffer(14);
  // console.log('reading the card')
  // var PN532_MIFARE_ISO14443A = 0x00;
  // rfid.readCard(PN532_MIFARE_ISO14443A, function(err, Card) {
  //   console.log('read the card and got [error, card]\t', err, '\n', Card, '\n', Card.uid);

  //   // Card.uid = [0x04, 0x0d, 0x40, 0x85, 0x9a, 0x62, 0x00, 0x00]
  //   //  var uidLen = 0x08;
  //   //  var key = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];

  //   var commandBuffer = [];

  //   commandBuffer.push()
});

rfid.irq.watch('fall', function() {
  console.log('\t\t\t\t---> IRQ Low');
  // rfid.emit('irq', null, 0);
});
rfid.irq.watch('rise', function() {console.log('\t\t\t\t---> IRQ High')});


  // rfid.on('data', function (uid) {
  //   console.log('\nRFID read UID:\n', time, '\n');
  //   for (var i = 0; i < uid.length; i++) {
  //     console.log('\t', i, '\t', uid[i], '\t', uid[i].toString(16));
  //   }
  // });
// });