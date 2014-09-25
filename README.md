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

  rfid.on('data', function(card) {
    console.log('UID:', card.uid.toString('hex'));
  });
});
```

###Methods

&#x20;<a href="#api-rfid-setPollPeriod-pollPeriod-callback-err" name="api-rfid-setPollPeriod-pollPeriod-callback-err">#</a> rfid<b>.setPollPeriod</b>( pollPeriod, callback(err) )  
 Set the time in milliseconds between each check for an RFID device. The poll period is 500ms by default.

&#x20;<a href="#api-rfid-mifareClassicAuthenticateBlock-cardUID-blockNumber-authType-authKey-callback-err" name="api-rfid-mifareClassicAuthenticateBlock-cardUID-blockNumber-authType-authKey-callback-err">#</a> rfid<b>.mifareClassicAuthenticateBlock</b>( cardUID, blockNumber, authType, authKey, callback(err) )  
 Authenticate a block of memory to read or write on a MIFARE classic card. cardUID is the UID of the card to authenticate. blockNumber is the block address to authenticate. authType can be 0 for authorization type A or 1 for type B. authKey is an array containing the authorization key for the memory block, most commonly [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF].  

&#x20;<a href="#api-rfid-mifareClassicReadBlock-blockNumber-callback-err-data" name="api-rfid-mifareClassicReadBlock-blockNumber-callback-err-data">#</a> rfid<b>.mifareClassicReadBlock</b>( blockNumber, callback(err, data) )  
 Read a block of memory on a MIFARE classic card. blockNumber is the address of the block to read.  

&#x20;<a href="#api-rfid-mifareClassicWriteBlock-blockNumber-data-callback-err" name="api-rfid-mifareClassicWriteBlock-blockNumber-data-callback-err">#</a> rfid<b>.mifareClassicWriteBlock</b>( blockNumber, data, callback(err) )  
 Write a block of memory on a MIFARE classic card. blockNumber is the address of the block to write. data is an array containing the 16 bytes of data to write to the block.  

&#x20;<a href="#api-rfid-startListening-callback-err-Tell-the-RFID-module-to-start-listening-for-targets-Only-necessary-when-configuring-the-module-for-manual-target-reading" name="api-rfid-startListening-callback-err-Tell-the-RFID-module-to-start-listening-for-targets-Only-necessary-when-configuring-the-module-for-manual-target-reading">#</a> rfid<b>.startListening</b>( callback(err) )  
 Tell the RFID module to start listening for targets. Only necessary when configuring the module for manual target reading.  

&#x20;<a href="#api-rfid-stopListening-callback-Tell-the-RFID-module-to-stop-listening-for-targets-This-will-also-disable-automatic-listening-for-targets" name="api-rfid-stopListening-callback-Tell-the-RFID-module-to-stop-listening-for-targets-This-will-also-disable-automatic-listening-for-targets">#</a> rfid<b>.stopListening</b>( callback() )  
 Tell the RFID module to stop listening for targets. This will also disable automatic listening for targets.  

##Events
&#x20;<a href="#api-rfid-on-data-callback-data" name="api-rfid-on-data-callback-data">#</a> rfid<b>.on</b>( 'data', callback(data) )  
 Emitted when an RFID target comes within range of the module.

&#x20;<a href="#api-rfid-on-read-callback-data" name="api-rfid-on-read-callback-data">#</a> rfid<b>.on</b>( 'read', callback(data) )  
 Same as 'data' event.

&#x20;<a href="#api-rfid-on-error-callback-err" name="api-rfid-on-error-callback-err">#</a> rfid<b>.on</b>( 'error', callback(err) )  
 Emitted upon error.  

&#x20;<a href="#api-rfid-on-ready-callback" name="api-rfid-on-ready-callback">#</a> rfid<b>.on</b>( 'ready', callback() )  
 Emitted upon first successful communication between the Tessel and the module.

###Further Examples  
* [Mifare Classic](//github.com/tessel/rfid-pn532/blob/master/examples/mifareClassic.js). This example authorizes a mifare classic for read/write operations. First it will read a block of data off the card, write new data over the block, and then read back the data on the card to verify that the data on the card has changed.

###Configuration
You can optionally configure how the RFID module listens for targets with an options argument in the `.use()` method. The supported options are `listen` and `delay`. Set `listen` to `true` to automatically listen for targets coming in range, or to `false` to manually control when the module should read targets. The default for this option is `true`. The `delay` option is used to set the amount of time in milliseconds to wait after reading a target to start listening again. The default for `delay` is 500 milliseconds. This option is ignored when `listen` is set to `false`.
```js
var tessel = require('tessel');
var rfid = require('rfid-pn532').use(
  tessel.port['A'],
  {
    listen: true, 
    delay: 500
  }
);
```

##TODO
Implement commands for additional NFC card/tag types

###License
