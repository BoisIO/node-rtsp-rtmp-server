var BufferReader = require('buffer-reader');
var child = require('child_process');
var io = require('socket.io');
var events = require('events');

var express = require('express')
var app = express();
var server = require('http').Server(app);

var io = require('socket.io')(server);
var fs = require('fs');

function cheesestream(port, streamId) {

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
    })

    //Logs via FFMPEG
    ffmpeg.stderr.on('data', function (buffer) {
       console.log(buffer.toString())
    });
    ffmpeg.stdout.on('data', function (buffer) {
       Emitter.emit('data',buffer)
    });

}

module.exports = cheesestream