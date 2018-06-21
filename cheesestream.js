var BufferReader = require('buffer-reader');
var child = require('child_process');
var io = require('socket.io');
var events = require('events');

var express = require('express')
var app = express();
var server = require('http').Server(app);

var io = require('socket.io')(server);
var fs = require('fs');
var request = require('request');
var querystring = require('querystring');
var crypto = require('crypto');

function cheesestream(port, streamId) {

    // posting port number and live status.
    var streamidentifier = streamId.slice(5);

    request.get('http://back3ndb0is.herokuapp.com/login', function(error, response, next){
        name = "Thijmen Boot";
        responseToken = response.headers.token;
        signature = signToken({token: responseToken}); 

        var form = {
            port: port
        };
    
        var formData = querystring.stringify(form);
        var contentLength = formData.length;
    
        request({
            headers: {
            'Content-Length': contentLength,
            'Content-Type': 'application/x-www-form-urlencoded',
            'name': name,
            'token': responseToken,
            'signature': signature
            },
            uri: 'http://back3ndb0is.herokuapp.com/streams/' + streamidentifier + '/toggle',
            body: formData,
            method: 'POST'
        }, function (err, res, body) {
            if(!err) { console.log("Opened server on API") }
        });
    });

    var spawn = child.spawn;
    var exec = child.exec;
    var Emitters = {}
    var config = {
        // port:8001,
        //Test url, will always work
        // url:'rtsp://184.72.239.149/vod/mp4:BigBuckBunny_175k.mov'
        url:'rtsp://145.49.53.161:80/' + streamId
    }

    var initEmitter = function(feed){
        if(!Emitters[feed]){
            Emitters[feed] = new events.EventEmitter().setMaxListeners(0)
        }
        return Emitters[feed]
    }
    //Uses the config port, needs a port to send
    console.log('Starting Express Web Server on Port '+port)
    server.listen(port);

    //Always serve index
    // app.get('/', function (req, res) {
    //     res.sendFile(__dirname + '/index.html');
    // })

    //FFMPEG pushed stream in here to make a pipe
    var count = 0; //Can be removed later, once android clears their plan up
    //Uses streamIn for incoming feeds, should be cleaned up later
    app.all('/', function (req, res) {
        //Initial emitter
        req.Emitter = initEmitter(req.params.feed)
        res.connection.setTimeout(0);
        //Buffer, handles authentication
        req.on('data', function(buffer){
            req.Emitter.emit('data',buffer)
            var packetNum = buffer

            var CleanBuffer = "";
            //Package checking part
            count++; //Can be removed, ups package count currently
            var reader = new BufferReader(buffer);
            var str = reader.restAll();

            buffer = buffer.toString('hex');
            const CountBuffer = buffer + "::" + count; //Currently used as testing
    /*
            //Check every 5 packages
            if(count % 5 == 0){ 
                //const CountBuffer = buffer + ":" + countor;
                console.log("=======================================")
                console.log(CountBuffer)
                console.log("=======================================")
            }
            //Cleanup Android stuff
            var CleanBuffer = CountBuffer.split('::')[0]
            console.log("================CLEN===================")
            console.log(CleanBuffer)
            console.log("=======================================")
    */
            //Buffer magic | Testing
            //var cheese = Buffer.from(CountBuffer, "hex")
            //console.log(cheese);

            //Converts stream to hex, for file saving
            var savedStream = Buffer.from(buffer, "hex");
            // console.log(savedStream);
            buffer = buffer.toString('hex');
            // console.log(buffer)

            //Saves stream to file
            // fs.appendFile(port +'.mp4', savedStream, function (err) {
            // if (err) throw err;
            // console.log('Saved!');
            // });

            //Savedstream = Clean Buffer, Verify = Hex, used to check and verify stream
            io.to('STREAM_'+req.params.feed).emit('h264',{feed:req.params.feed,buffer:savedStream, verify: CountBuffer})
        });
        req.on('end',function(){
            console.log('close');
        });
    })

    //socket.io client commands
    io.on('connection', function (cn) {
        cn.on('f',function (data) {
            switch(data.function){
                case'getStream':
                    console.log(data)
                    cn.join('STREAM_'+data.feed)
                break;
            }
        })
    });

    //FFMPEG
    console.log('Starting FFMPEG')

    var ffmpegString = '-i '+config.url+''
    ffmpegString += ' -f mpegts -c:v mpeg1video -codec:a mp2 -b 0 http://localhost:'+port+'/'
    if(ffmpegString.indexOf('rtsp://')>-1){
        ffmpegString='-rtsp_transport tcp '+ffmpegString
    }

    console.log('Executing : ffmpeg '+ffmpegString)
    var ffmpeg = spawn('ffmpeg',ffmpegString.split(' '));

    //Handle close
    ffmpeg.on('close', function (buffer) {
        console.log('ffmpeg died')

        request.get('http://back3ndb0is.herokuapp.com/login', function(error, response, next){
            name = "Thijmen Boot";
            responseToken = response.headers.token;
            signature = signToken({token: responseToken}); 
    
            var form = {
                port: port
            };
        
            var formData = querystring.stringify(form);
            var contentLength = formData.length;
        
            request({
                headers: {
                'Content-Length': contentLength,
                'Content-Type': 'application/x-www-form-urlencoded',
                'token': responseToken,
                'signature': signature,
                'name': name
                },
                uri: 'http://back3ndb0is.herokuapp.com/streams/' + streamId + '/toggle',
                method: 'DELETE'
            }, function (err, res, body) {
                if(!err){ console.log("API stream closed.") }

            });
        });
    })

    //Logs via FFMPEG
    ffmpeg.stderr.on('data', function (buffer) {
       console.log(buffer.toString())
    });
    ffmpeg.stdout.on('data', function (buffer) {
       Emitter.emit('data',buffer)
    });

    // private key to test authentication
    var test_certificate = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEApyYdM\/GSWaSyupbCk5et0Fs6nhWNG2YlJrrADVBxSYpW6956\nNC5JmFnhv47WLgbxtHJLMzLkRHNPCrWphFCqDvnY3KA21oMH02SOD4KLkEgoZl\/o\nIp3BFVD8yQRFkofCyVJOlZYZgBSNIOGOfvBDNhrFt547LNlxKZu\/LKItBroyIyh\/\ngh7EoO5K6GZYkOe4et9jJa2nUjeje+7n7bh4gfOkgcTfDvA5ZWavk1NzpwJ7KQfe\nU4\/Eyx7vVn0OkxyVZZcaxVniqecvoRZV+09oKtjSLZncfznV+NfdVD05DF6GC3u8\nz5iTwuH035I+DOQTBx2QpifAamHEfHrmo9wOjwIDAQABAoIBAHGPtZuK7vG0sjGP\nKBd6n\/7FXKf24G3TEj6j9sOU+cMLGE8cUk6NfDbkKjopY17WHPWKCYl5dBkFdphC\nIC\/jVgbivPH4cAmB8Jkw4kurWALo43nagy6xm3NOGNDB9Dq\/vhllsDp1RlH8pH3I\ngTXBKwjhW5+LA41PFlE8ncBHVuwQD6w\/qaqXz9UoUJRYKeX571tkZw\/xuS8rsC2D\nLscYxiro7FfHX7tQd1sBYBdg8aDx0HRSeci6cyYVD6iw974i0pl4V76mds4fy5pY\nnVAEj9A9c9kM1v92lKKJqul34d2ay0+dphVq9G6mBVOPUVKzT4YZf8XCioNniEQ\/\n2Ay95tECgYEA1hrZGR3iZF0OQhPlOKzPk5KikeURs5gf5R8AvlKY0dnystBRteEJ\nG7d2damfbSzfhiJHiz7+0I3Kcm4b8tLLGoq8p\/IZWVyTrer+upOC+ixshwaeAwcI\n4iAMvPyCueCylAwsaUK3adIbmG63gFyBfZMzqR\/JtmtuykpgGWuOcxsCgYEAx9sZ\nrXb7Z6FfMNqeFsKTc2EpUAmJVC+hJc\/L59eWYaFT+2H4mM6BvN+NS32J4zXqskwn\nPTPXhgUB2MkNf1Y82L3h1dkXo0w1FQjNc95dSzR+vL88nGuLe5ivc59od6otwzqa\nqzwa9UoSnEYNRggGq\/uGnLSu3+7obFi3pRjO1Z0CgYEAkiwcQbiUYp7haB17Jjld\nMkwvL1nrvuhCBkQnVsi\/Sq34sznkPz8W39ReTLB0hq3XIRVwMNHeV\/Yl2\/\/ultZx\nEXrcl\/CCe+7naBqCtFCXYENKCNlssXZxCyiEadYfTdXpNYgmHesNm3J1opkcMMd3\nJIuF\/pYUObWZGwSyHUjAJTcCgYArMwrr2eohzlnbH4ZIeSqSKBBcApOypND6cV4r\n8QfKdqrGjbjEnu6gOto51Rr3B\/KBM8DPk+MkTvTFPUAzpBpm5zRnmxNm8tQOheaT\nAx+7X899UQDy9rQhtTFHls9n\/lsB9ir0lHtnRemb6fB4kMeQaUABo3ShZuzKbqrT\nfvdGaQKBgQDBtOnuSbsAcr4ZIRI0FLWtL1Df2s79nNgDpFmddODPdOjCTNmuQQH4\n2kDJk8vIJCpBFA44hazi9lLuScOpZLF2EtIZOi8cUg9FQJM8IfmZO+1bSdmiNJcn\n9VihyKnoWSx0dAsLHi+KT5q5AAriYRJyu5RXUy2HUzxlHPNjin+VAQ==\n-----END RSA PRIVATE KEY-----';
    function signToken(data) { // Functie om datas te signen
        if(!data) return false // Om te voorkomen dat alles vastloopt als de data leeg is

        console.log(test_certificate);
    
        let sign = crypto.createSign('RSA-SHA256') // De sign instantie
        sign.write(JSON.stringify(data)) // Het token wordt gesigned 
        sign.end() 
        return sign.sign(test_certificate, 'hex') // De signature wordt teruggestuurd
    }

}

module.exports = cheesestream