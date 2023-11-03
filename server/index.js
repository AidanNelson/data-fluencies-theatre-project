// HTTP Server setup:
// https://stackoverflow.com/questions/27393705/how-to-resolve-a-socket-io-404-not-found-error
const express = require('express');
const http = require('http');
const Datastore = require('nedb');
const fs = require('fs');
const { Server } = require('socket.io');

async function main() {
  const app = express();

  const server = http.createServer(app);

  const distFolder = process.cwd() + '/src';
  console.log('Serving static files at ', distFolder);
  app.use(express.static(process.cwd() + '/src'));

  const port = 3131;
  server.listen(port);
  console.log(`Server listening on port ${port}`);

  let db = new Datastore({
    filename: 'text.db',
    timestampData: true,
  }); //creates a new one if needed
  db.loadDatabase(); //loads the db with the data

  const io = new Server();

  io.attach(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e8,
  });

  io.on('connection', (socket) => {
    console.log(
      'User ' +
        socket.id +
        ' connected, there are ' +
        io.engine.clientsCount +
        ' clients connected'
    );

    socket.on('disconnect', () => {
      console.log('client disconnected: ', socket.id);
    });

    socket.on('uploadAudio', (file, callback) => {
      console.log('received file: ', file.name); // <Buffer 25 50 44 ...>

      fs.writeFile('./uploads/' + file.name, file.data, (err) => {
        callback({ message: err ? 'failure' : 'success' });
        console.log(err ? err : "success");
      });
    });

    socket.on('uploadText', (data, callback) => {
      console.log('received text: ', data);
      db.insert({ message: data });

      callback({ message: 'success' });
    });
  });
}

main();
