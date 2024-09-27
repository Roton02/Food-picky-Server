const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://a11-kynus-foodie.web.app",
      "https://a11-kynus-foodie.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// MiddleWare
const logger = (req, res, next) => {
  console.log(req.hostname);
  next();
};
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  // console.log(req.cookies);
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Authorization access not allow" });
  }
  jwt.verify(token, process.env.SECRETE_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "UnAuthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.mi2xoxt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //json web token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRETE_ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/loggout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ logoutSuccess: true });
    });

    const FeaturedCollection = client
      .db("FoodPicky")
      .collection("FeaturedProduct");
    const countryCollection = client.db("FoodPicky").collection("country");
    app.get("/featured", async (req, res) => {
      // console.log(req.user);

      let query = {};
      if (req.query?.email) {
        query = { "donator.email": req.query.email };
      }
      if (req.query?.id) {
        query = { _id: new ObjectId(req.query.id) };
      }
      // console.log(query);
      const cursor = await FeaturedCollection.find(query).toArray();
      res.send(cursor);
    });
    app.get("/featured/avilable", async (req, res) => {
      const sort = req.query.sorts;
      // console.log(sort);
      const search = req.query.search;
      // console.log(search);
      const searchQuery = { $regex: search, $options: "i" };
      let query = { status: "available" };
      if (search) {
        query = { ...query, food_name: searchQuery };
      }
      let options = {};
      if (sort) {
        options = {
          sort: { expired_datetime: sort === "recentDays" ? 1 : -1 },
        };
        const result = await FeaturedCollection.find(query, options).toArray();
        return res.send(result);
      }

      const cursor = await FeaturedCollection.find(query).toArray();
      res.send(cursor);
    });
    app.get("/featured/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await FeaturedCollection.findOne(query);
      res.send(result);
    });
    app.get("/featured-info/:email", logger, verifyToken, async (req, res) => {
      if (req.params?.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const email = req.params?.email;
      const query = { "donator.email": email };
      const cursor = await FeaturedCollection.find(query).toArray();
      res.send(cursor);
    });

    app.post("/addFood", async (req, res) => {
      const foodData = req.body;
      const result = await FeaturedCollection.insertOne(foodData);
      res.send(result);
    });
    app.delete("/delete/:id", async (req, res) => {
      const id = req.params.id;
      console.log(req.params.id);
      const query = { _id: new ObjectId(id) };
      const result = await FeaturedCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const update = {
        $set: {
          email: req.body.email,
          food_name: req.body.food_name,
          food_image: req.body.food_image,
          quantity: req.body.quantity,
          expired_datetime: req.body.expired_datetime,
          pickup_location: req.body.pickup_location,
          additional_notes: req.body.additional_notes,
        },
      };
      const result = await FeaturedCollection.updateOne(query, update, options);
      res.send(result);
    });
    app.post("/requested", async (req, res) => {
      const updateData = {
        $set: {
          status: "requested",
          requsterEmail: req.body.requsterEmail,
          additional_notes: req.body.additional_notes,
        },
      };
      // const result = await requestedCollection.insertOne(requestDoc);
      const result = await FeaturedCollection.updateOne(
        { _id: new ObjectId(req.body._id) },
        updateData
      );
      res.send(result);
    });
    app.get("/requested/:email", logger, verifyToken, async (req, res) => {
      console.log(req.user);
      if (req.params?.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const mail = req.params.email;
      const query = { requsterEmail: mail };
      const result = await FeaturedCollection.find(query).toArray();
      res.send(result);
    });
    // new code ----- 09 / 24 /2024
    app.get("/country", async (req, res) => {
      const result = await countryCollection.find().toArray()
      res.send(result)
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      " successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
