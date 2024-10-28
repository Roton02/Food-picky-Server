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
  // console.log(req.hostname);
  next();
};
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  // console.log(req.cookies);
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Authorization access not allow" });
  }
  jwt.verify(token, process.env.SECRETE_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "UnAuthorized Access" });
    }
    req.user = decoded;
    // console.log(decoded);
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
    const ReviewsCollection = client.db("FoodPicky").collection("reviews");
    const userCollection = client.db("FoodPicky").collection("users");
    const RequestCollection = client
      .db("FoodPicky")
      .collection("requestedList");
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
    // app.get("/featured/avilable", async (req, res) => {
    //   const sort = req.query.sorts;
    //   // console.log(sort);
    //   const priceRange = req.query.priceRange;
    //   console.log('priceRange',priceRange );

    //   const search = req.query.search;
    //   // console.log(search);
    //   const searchQuery = { $regex: search, $options: "i" };
    //   let query = {  };
    //   if (search) {
    //     query = { ...query, food_name: searchQuery };
    //   }
    //   let options = {};
    //   if (sort) {
    //     options = {
    //       sort: { expired_datetime: sort === "recentDays" ? 1 : -1 },
    //     };
    //     const result = await FeaturedCollection.find(query, options).toArray();
    //     return res.send(result);
    //   }

    //   const cursor = await FeaturedCollection.find(query).toArray();
    //   res.send(cursor);
    // });
    app.get("/featured/avilable", async (req, res) => {
      const sort = req.query.sorts;
      const priceRange = req.query.priceRange;
      const search = req.query.search;
      const brands = req.query.brands;
      const searchQuery = { $regex: search, $options: "i" };
      console.log("the brands", brands);
      // Initialize query and options
      let query = {};
      let options = {};

      // Add search condition if `search` is provided
      if (search) {
        query = { ...query, food_name: searchQuery };
      }
      // Brands filter
      if (brands && brands !== "") {
        const brandArray = brands.split(",");
        query.pickup_location = { $in: brandArray };
      }

      // Determine sort options for `sorts` and `priceRange`
      if (sort) {
        options.sort = { expired_datetime: sort === "recentDays" ? 1 : -1 };
      }
      if (priceRange) {
        options.sort = { price: priceRange === "HtO" ? 1 : -1 };
      }

      try {
        // Fetch data from the database with the given query and options
        const result = await FeaturedCollection.find(query, options).toArray();

        // Send the result back to the client
        if (result.length === 0) {
          return res.status(404).json({ message: "Data not found" });
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/FoodCount", async (req, res) => {
      const count = await FeaturedCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/featured/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await FeaturedCollection.findOne(query);
      res.send(result);
    });
    app.get("/featured-info/:email", async (req, res) => {
      // if (req.params?.email !== req.user.email) {
      //   return res.status(403).send({ message: "Forbidden" });
      // }
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
      // console.log(req.params.id);
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
      requestFoord = req.body;
      console.log(requestFoord);

      // const result = await requestedCollection.insertOne(requestDoc);
      const result = await RequestCollection.insertOne(requestFoord);
      res.send(result);
    });
    app.get("/requested/:email", logger, verifyToken, async (req, res) => {
      // console.log(req.user);
      if (req.params?.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const mail = req.params.email;
      const query = { requsterEmail: mail };
      const result = await RequestCollection.find(query).toArray();
      res.send(result);
    });
    // new code ----- 09 / 24 /2024
    app.get("/country", async (req, res) => {
      const result = await countryCollection.find().toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      // console.log(review);
      const result = await ReviewsCollection.insertOne(review);
      res.send(result);
    });
    app.get("/reviewsCollection", async (req, res) => {
      const cursor = await ReviewsCollection.find().toArray();
      res.send(cursor);
    });

    // Admi Router
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/Admin/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // app.get("/users/admin/:email", verifyToken, async (req, res) => {
    //   const email = req.params.email;
    //   console.log("object", req.user);

    //   if (email !== req.user.email) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }

    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   console.log("user", email);
    //   // let admin = false;
    //   // if (user) {
    //   //   admin = user?.role === "admin";
    //   //   admin = true
    //   // }

    //   res.send( user?.role );
    // });
    app.get("/users/admins/:email", logger, verifyToken, async (req, res) => {
      const reqEmail = req.params?.email;
      // console.log("reqEmail", reqEmail);
      const query = { email: `${reqEmail}` };
      // console.log(query);
      // const result = await userCollection.findOne(query);
      // console.log("user", result);
      // res.send(result);
      if (reqEmail) {
        const result = await userCollection.findOne(query);
        // console.log(" Server user", result);
        res.send(result);
      }
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/Admin/AllFood", async (req, res) => {
      const cursor = await FeaturedCollection.find().toArray();
      res.send(cursor);
    });
    app.delete("/allcategory/admin/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await FeaturedCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/Admin/requested", async (req, res) => {
      // console.log(req.user);
      // const query = { status: "requested" };
      const result = await RequestCollection.find().toArray();
      res.send(result);
    });

    app.patch("/admin/updateAccepted", async (req, res) => {
      const id = req.body.id;
      console.log(id);
      const updateData = {
        $set: {
          status: "accepted",
        },
      };
      const result = await FeaturedCollection.updateOne(
        { _id: new ObjectId(id) },
        updateData
      );
      res.send(result);
      res.send({ data: true });
    });
    app.patch("/admin/updateStockover", async (req, res) => {
      const id = req.body.id;
      console.log(id);
      const updateData = {
        $set: {
          status: "StockOut",
        },
      };
      const result = await FeaturedCollection.updateOne(
        { _id: new ObjectId(id) },
        updateData
      );
      res.send(result);
    });
    // Comment add
    app.patch("/commentAdd", async (req, res) => {
      const id = req.body.id_1; // Ensure `id_1` is passed correctly from the client
      const comment = {
        id: req.body.id,
        name: req.body.name,
        image: req.body.image,
        text: req.body.text,
      }; // Create the comment object with the provided data
    
      console.log('New Comment:', comment);
    
      const updateData = {
        $push: {
          comments: comment,
        },
      };
      const options = { upsert: true }; // Set options separately
    
      try {
        const result = await FeaturedCollection.updateOne(
          { _id: new ObjectId(id) },
          updateData, // Place update data here
          options // Pass options last
        );
    
        if (result.modifiedCount > 0) {
          res.status(200).send(result);
        } else {
          res.status(400).send({ error: "Failed to add comment" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while adding the comment" });
      }
    });
    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(" successful connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
