const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ltkvgnf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const usersCollection = client.db("clickDB").collection("users");
    const classesCollection = client.db("clickDB").collection("classes");
    const myClassCollection = client.db("clickDB").collection("myClasses");
    const cartCollection = client.db("clickDB").collection("carts");
    const paymentCollection = client.db("clickDB").collection("payments");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'1h'})

      res.send({token})
    })



    // verifyjwt 

    const verifyJWT = (req, res, next) =>{
      const authorization = req.headers.authorization;
      if(!authorization){
        return res.status(401).send({error: true, message: 'unauthorized access'});
      }
      const token = authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
          return res.status(401).send({error: true, message: 'unauthorized access'});
        }
        req.decoded = decoded;
        next();
      })
    }




    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'forbidden message'})
      }
      next()
    }

    const verifyInstructor = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'instructor'){
        return res.status(403).send({error: true, message: 'forbidden message'})
      }
      next()
    }


    // users 

    app.get('/users', verifyJWT, verifyAdmin, async(req, res)=> {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      if(existingUser){
        return res.send({message: 'user already exist'})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;
      if(req.decoded.email !== email){
        res.send({admin: false})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role === 'admin'}
      res.send(result)
    })

    app.get('/users/instructor/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;
      if(req.decoded.email !== email){
        res.send({instructor: false})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = {instructor: user?.role === 'instructor'}
      res.send(result)
    })


    app.get('/users/instructor', async(req, res) => {
      try {
        const query = {role: 'instructor'};
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      }catch(error){
        res.send(error)
      }
    })

    app.patch('/users/admin/:id', async(req, res)=> {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.patch('/users/instructor/:id', async(req, res)=> {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // my classes 
    app.get('/myclass', async(req, res)=>{
      const result = await myClassCollection.find().toArray()
      res.send(result)
    })

    app.post('/myclass', async(req, res)=>{
      const item = req.body;
      const result = await myClassCollection.insertOne(item);
      res.send(result)
    })



    app.get('/classes', async(req, res)=> {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })

    app.post('/classes', async(req, res)=> {
      const item = req.body;
        const result = await classesCollection.insertOne(item);
        res.send(result);
    })

    app.post('/carts',  async(req, res)=> {
        const item = req.body;
        const result = await cartCollection.insertOne(item);
        res.send(result);
    })

    app.get('/carts', verifyJWT, async(req, res) => {
      const email = req.query.email;
      if(!email){
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'forbidden access'});
      }
     
        const query = {email: email};
        const result = await cartCollection.find(query).toArray();
        res.send(result)
      
    })

    // delete 

    app.delete('/carts/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })


      app.post('/create-payment-intent', verifyJWT, async(req, res) => {
        const {price} = req.body;
        const amount = price*100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        })
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      })



      app.post('/payments', verifyJWT, async(req, res) => {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment)
        const query = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}}
        const deleteResult = await cartCollection.deleteMany(query)
        res.send({insertResult, deleteResult})
      })






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('click is running')
})

app.listen(port, ()=> {
    console.log(`click is running ${port}`);
})