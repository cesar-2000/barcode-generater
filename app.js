var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require('fs');
var cors = require('cors');
const csv = require('csvtojson');
const bwipjs = require('bwip-js');
var zip = require('express-zip');
const path = require('path');

var barcodeJson = []; // from csv file
var barcodeFiles = []; // generate barcode as png file

app.use(cors());
app.use(bodyParser.json());

//multers disk storage settings
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
    }
});

//multer settings
var upload = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
        //file filter
        if (['csv'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

/** API path that will upload the files */
app.post('/upload', function (req, res) {
    console.log('csv file upload requesting...')
    barcodeJson = [];
    var tempBarcodeJson = [];


    upload(req, res, function (err) {
        if (err) {
            res.json({ error_code: 1, err_desc: err });
            return;
        }

        let csvDataBuffer = JSON.stringify(req.body);
        let csvData = JSON.parse(csvDataBuffer).data;
        let csvDataString = csvData.toString("utf8");

        return csv()
            .fromString(csvDataString)
            .then(json => {
                let filteredJSON = [];
                // filter existing barcode
                if (barcodeFiles.length) {
                    json.forEach(element => {
                        let fileName = element['type;value'].split(';') + '.png';
                        let flag = true;

                        console.log('filename>>>', fileName);

                        barcodeFiles.every(barcode => {
                            if (barcode.name === fileName) {
                                flag = false;
                                return false;
                            }
                        });

                        if (flag) {
                            filteredJSON.push(element)
                        }
                    });

                    tempBarcodeJson = filteredJSON;
                } else {
                    tempBarcodeJson = json;
                }

                // remove duplicate barcode
                var valueArr = tempBarcodeJson.map(function (item) { return item['type;value'] });
                valueArr.some(function (item, idx) {
                    if (valueArr.indexOf(item) == idx) {
                        barcodeJson.push(tempBarcodeJson[idx]);
                    }
                });

                console.log('barcodeJson>>>', barcodeJson)
                return res.json({ error_code: 0, err_desc: null, message: "Uploaded successfully" });
            })
    });

});

app.get('/generate', function (req, res) {
    console.log('generating barcode is started...')

    if (!barcodeJson.length) {
        res.json({ error_code: 1, err_desc: "Please upload csv file" });
        return;
    }

    if (barcodeFiles.length) {
        console.log('Deleting barcode images started...');
        barcodeFiles.forEach(element => {
            fs.unlink(element.path, function (err) {
                if (err) return console.log('no such file or directory...', err);
                console.log('File deleted..');
            })
            // fs.unlinkSync(element.path); // Deleting the barcode png
        });
        console.log('Deleting barcode images finished...');

        barcodeFiles = [];
    }


    barcodeJson.forEach((element, index) => {
        console.log(index, ' element>>>', element)
        let value = element['type;value'].split(';');
        let type = value[0];
        let data = value[1];

        if (type === 'ean13') {
            data = data.substr(1);
        }

        bwipjs.toBuffer({
            bcid: type,       // Barcode type
            text: data,    // Text to encode
            scale: 3,               // 3x scaling factor
            height: 10,              // Bar height, in millimeters
            includetext: true,
            textxalign: 'center',
        })
            .then(png => {
                var filePath = `./barcodes/${data}.png`;
                fs.writeFileSync(filePath, png);
                barcodeFiles.push({ path: filePath, name: `${data}.png` });
            })
            .catch(err => {
                console.log('generate barcode error>>', err)
                res.json({ error_code: 1, err_desc: err });
                return;
            });

    });

    console.log('generating barcode is finished...')
    res.json({ error_code: 0, err_desc: null, message: "Barcode is generated successfully" });
});

app.get('/download', function (req, res) {
    console.log('download api is working...');
    if (!barcodeFiles.length) {
        console.log('there is no data to download');
        res.json({ error_code: 1, err_desc: "there is no data to download" });
        return;
    }

    console.log('barcodeFiles>>>', barcodeFiles);

    res.zip(barcodeFiles)

    console.log('download api is finished');
});

// app.get('/', function (req, res) {
//     console.log('api is working fine...')
//     res.sendFile(__dirname + "/index.html");
// });

app.get('/test', function (req, res) {
    console.log('test api is working');
    res.json({ error_code: 0, err_desc: null, message: "test api is working fine" });
});

// app.get('/*', function(req, res) {
//     res.sendFile(path.join(__dirname, 'dist/client', 'index.html'));
// });
app.use(express.static(__dirname + '/dist/client'));

//const PORT = process.env.PORT || 8080;

app.listen(8080, function () {
    console.log('running on 3000...');
});