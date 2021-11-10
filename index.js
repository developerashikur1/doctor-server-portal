
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');



// middleware
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jbkru.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken (req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    try{
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser?.email;
    }
    catch{
    }
  }
  next();
}


async function run() {
    try{
        client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users')

        // get appointments by query
        app.get('/appointments',verifyToken, async(req, res)=>{
          const email = req.query.email;
          const date = new Date(req.query.date).toLocaleDateString('en-US', {timeZone: 'UTC'});
          const query = {email:email, date:date};
          const appointments = appointmentsCollection.find(query);
          const result = await appointments.toArray();
          res.json(result);
        })

        // get users with email
        app.get('/users/:email', async(req, res)=>{
          const email = req.params.email;
          const query = {email:email}
          const user = await usersCollection.findOne(query);
          let isAdmin = false;
          if(user?.role === 'admin'){
            isAdmin = true;
          }

          res.json({admin:isAdmin})
        })

        //  insert a appointments
        app.post('/appointments', async (req, res) => {
          const appointment = req.body;
          const result = await appointmentsCollection.insertOne(appointment);
          console.log(result);
          res.json(result)
        })

        // post api
        app.post('/users', async(req, res)=>{
          const user = req.body;
          const result = await usersCollection.insertOne(user);
          res.json(result);
        })

        // users put api
        app.put('/users', async(req,res)=>{
          const user = req.body;
          const filter = {email: user.email};
          const updateDoc = {$set:user};
          const options = { upsert: true };
          const result = await usersCollection.updateOne(filter, updateDoc, options);
          res.json(result)
        })

        // admin put api
        app.put('/users/admin',verifyToken, async(req,res)=>{
          const user = req.body;
          const requester= req.decodedEmail;
          console.log(requester)
          if(requester){
            const requesterAccount = await usersCollection.findOne({email:requester});
            if(requesterAccount.role === 'admin'){
              const filter = {email: user.email};
              const updateDoc = {$set:{role:'admin'}}
              const result = await usersCollection.updateOne(filter, updateDoc);
              res.json(result)
            }
          }
          else{
            res.status(403).json({message:'You do not have access to be admin'})
          }
          // const filter = {email: user.email};
          //     const updateDoc = {$set:{role:'admin'}}
          //     const result = await usersCollection.updateOne(filter, updateDoc);
          //     res.json(result)
         
        })

    }
    finally{
        // client.close();
    }
}
run().catch(console.dir)




app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})