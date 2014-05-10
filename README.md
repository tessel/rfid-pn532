#RFID
Driver for the rfid-pn532 Tessel RFID module ([PN532](http://www.adafruit.com/datasheets/pn532longds.pdf)).

##TODO
Get auth working

##Installation
```sh
npm install rfid-pn532
```
##Example
```js
/*********************************************
This basic rfid example listens for an RFID
device to come within range of the module,
then logs its UID to the console.
*********************************************/

var tessel = require('tessel');
var rfid = require('../').use(tessel.port('A'));

rfid.on('ready', function (version) {
  console.log('Ready to read RFID card');

  rfid.on('data', function(uid) {
    console.log('UID:', uid);
  });
});
```

##Methods

*  **`rfid`.setPollPeriod(pollPeriod, callback(err))** Set the time in milliseconds between each check for an RFID device.

##Events

* *data* Emitted when data is available.

* *error* Emitted upon error.

* *ready* Emitted upon first successful communication between the Tessel and the module.

## License
MIT
APACHE
