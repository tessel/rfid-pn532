#RFID
Driver for the rfid-pn532 Tessel RFID module ([PN532](http://www.adafruit.com/datasheets/pn532longds.pdf)).

##TODO
Get auth working, read/write to card capabilities

##Installation
```sh
npm install rfid-pn532
```
##Example
```js
/*********************************************
This basic RFID example listens for an RFID
device to come within range of the module,
then logs its UID to the console.
*********************************************/

var tessel = require('tessel');

var rfid = require('../').use(tessel.port['A']); // Replace '../' with 'rfid-pn532' in your own code

rfid.on('ready', function (version) {
  console.log('Ready to read RFID card');

  rfid.on('data', function(uid) {
    console.log('UID:', uid);
  });
});
```

##Methods

##### * `rfid.setPollPeriod(pollPeriod, callback(err))` Set the time in milliseconds between each check for an RFID device.

##Events

##### * `rfid.on('data', callback(data))` Emitted when data is available.

##### * `rfid.on('error', callback(err))` Emitted upon error.

##### * `rfid.on('ready', callback())` Emitted upon first successful communication between the Tessel and the module.

## License
MIT
APACHE
