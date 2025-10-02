import express from "express";
import { Kafka } from "kafkajs";
import cors from "cors";

// Kafka configuration
const app = express();
// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000", // Allow requests from this origin
  })
);

// Initialize Kafka client with connection configuration
const kafka = new Kafka({
  clientId: "payment-service", // Unique identifier for this Kafka client instance
  brokers: ["localhost:9094"], // Kafka broker addresses - matches docker-compose PLAINTEXT_HOST listener
});

// Kafka Producer Setup
const producer = kafka.producer();


const connectToKafka = async () => {
  try {
    await producer.connect(); 
    console.log("Connected to Kafka broker");
  } catch (error) {
    console.error("Error connecting to Kafka broker:", error);
  }
};



// API endpoint to handle payment processing
app.post("/payment-service", async (req, res) => {
  const { cart } = req.body;
  // ASSUME THAT WE GET THE COOKIE AND DECRYPT THE USER ID
  const userId = "123";

  // TODO:PAYMENT
  console.log("API endpoint hit at payment service")

  // microservices communication part
  // Send message to Kafka topic indicating successful payment
  await producer.send({
    topic: "payment-successful", // Topic to which the message will be sent
    messages: [
      {
        value: JSON.stringify({
          userId,
          cart,
        }),
      },
    ],
  });
  console.log("Payment processed and message sent to Kafka");
  return res.status(200).send("Payment processed successfully");
});

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).send(err.message);
});



// app.listen(8000, callback)
// Start the Express server
app.listen(8000, () => {
  connectToKafka(); // Connect to Kafka when the server starts
  console.log("Payment service is running on port 8000");
});

