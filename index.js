const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.mi2xoxt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
    const FeaturedCollection = client.db('FoodPicky').collection('FeaturedProduct')
    app.get('/featured', async (req,res)=>{
      let query = {};
      if (req.query?.email) {
        query = {'donator.email': req.query.email };
      }
      if(req.query?.id){
        query = {_id : new ObjectId(req.query.id)}
      }
      // console.log(query);
      const cursor = await FeaturedCollection.find(query).toArray()
      res.send(cursor)
    })
    app.get('/featured/avilable', async(req,res)=>{
      const query = {status : 'available'}
      const cursor = await FeaturedCollection.find(query).toArray()
      res.send(cursor)
    })
    app.get('/featured/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await FeaturedCollection.findOne(query)
      res.send(result)
    })

    app.post('/addFood', async(req, res)=>{
      const foodData = req.body;
      const result = await FeaturedCollection.insertOne(foodData);
      res.send(result)
    })
    app.delete('/delete/:id' , async (req,res)=>{
      const id = req.params.id
      console.log(req.params.id);
      const query = {_id : new ObjectId(id)}
      const result = await FeaturedCollection.deleteOne(query)
      res.send(result)
    })
    app.patch('/update/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const options = { upsert: true };
      const update = { 
        $set:{
          email: req.body.email,
          food_name:req.body.food_name, 
          food_image:req.body.food_image, 
          quantity:req.body.quantity, 
          expired_datetime:req.body.expired_datetime, 
          pickup_location:req.body.pickup_location, 
          additional_notes:req.body.additional_notes
         
      }
    };
    const result = await FeaturedCollection.updateOne(query,  update,options)
    res.send(result)
    })
    app.post('/requested' , async (req, res)=>{
      const updateData ={$set:{
        status:'requested',
        requsterEmail: req.body.requsterEmail,
        additional_notes: req.body.additional_notes

      }}
      // const result = await requestedCollection.insertOne(requestDoc);
      const result = await FeaturedCollection.updateOne({_id : new ObjectId(req.body._id)},updateData)
      res.send(result)
    })
    app.get('/requested/:email', async (req,res) =>{
      const mail = req.params.email;
      const query = {requsterEmail: mail}
      const result = await FeaturedCollection.find(query).toArray();
      res.send(result)
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


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})