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
  
  // rfid.accessMem();

  rfid.on('data', function (uid) {
    console.log('\nRFID read UID:\n', time, '\n');
    for (var i = 0; i < uid.length; i++) {
      console.log('\t', i, '\t', uid[i], '\t', uid[i].toString(16));
    }
  });
});

rfid.on('irq', function() {
  console.log('\t\t\t\t---> IRQ Low');
  // rfid.emit('irq', null, 0);
});
rfid.irq.watch('rise', function() {console.log('\t\t\t\t---> IRQ High')});


