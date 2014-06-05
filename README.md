#RFID
Driver for the rfid-pn532 Tessel RFID module. The hardware documentation for this module can be found [here](https://github.com/tessel/hardware/blob/master/modules-overview.md#rfid).

If you run into any issues you can ask for support on the [RFID Module Forums](http://forums.tessel.io/category/rfid).

###Installation
```sh
npm install rfid-pn532
```
###Example
```js
/*********************************************
This basic RFID example listens for an RFID
device to come within range of the module,
then logs its UID to the console.
*********************************************/

var tessel = require('tessel');
var rfidlib = require('rfid-pn532');

var rfid = rfidlib.use(tessel.port['A']); 

rfid.on('ready', function (version) {
  console.log('Ready to read RFID card');

  rfid.on('data', function(uid) {
    console.log('UID:', uid);
  });
});
```

###Methods

&#x20;<a href="#api-rfid-setPollPeriod-pollPeriod-callback-err-Set-the-time-in-milliseconds-between-each-check-for-an-RFID-device" name="api-rfid-setPollPeriod-pollPeriod-callback-err-Set-the-time-in-milliseconds-between-each-check-for-an-RFID-device">#</a> rfid<b>.setPollPeriod</b>( pollPeriod, callback(err) ) Set the time in milliseconds between each check for an RFID device.  

###Events
[#] rfid.mifareClassicAuthenticateBlock(cardUID, blockNumber, authType, authKey, callback(err)) Authenticate a block of memory to read or write on a MIFARE classic card. `cardUID` is the UID of the card to authenticate. `blockNumber` is the block address to authenticate. `authType` can be `0` for authorization type A or `1` for type B. `authKey` is an array containing the authorization key for the memory block, most commonly `[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]`.

[#] rfid.mifareClassicReadBlock(blockNumber, callback(err, data)) Read a block of memory on a MIFARE classic card. `blockNumber` is the address of the block to read.

[#] rfid.mifareClassicWriteBlock(blockNumber, data, callback(err)) Write a block of memory on a MIFARE classic card. `blockNumber` is the address of the block to write. `data` is an array containing the 16 bytes of data to write to the block.

##Events
=======
&#x20;<a href="#api-rfid-on-data-callback-data-Emitted-when-data-is-available" name="api-rfid-on-data-callback-data-Emitted-when-data-is-available">#</a> rfid<b>.on</b>( 'data', callback(data) ) Emitted when data is available.  
>>>>>>> Updates readme to current style syntax, updates example import syntax

&#x20;<a href="#api-rfid-on-error-callback-err-Emitted-upon-error" name="api-rfid-on-error-callback-err-Emitted-upon-error">#</a> rfid<b>.on</b>( 'error', callback(err) ) Emitted upon error.  

&#x20;<a href="#api-rfid-on-ready-callback-Emitted-upon-first-successful-communication-between-the-Tessel-and-the-module" name="api-rfid-on-ready-callback-Emitted-upon-first-successful-communication-between-the-Tessel-and-the-module">#</a> rfid<b>.on</b>( 'ready', callback() ) Emitted upon first successful communication between the Tessel and the module.  

###Further Examples  
* [Mifare Classic](link to example for this in the "examples" folder). This example authorizes a mifare classic for read/write operations. First it will read a block of data off the card, write new data over the block, and then read back the data on the card to verify that the data on the card has changed.

###TODO
Implement commands for additional NFC card types

###License
MIT or Apache 2.0, at your option

