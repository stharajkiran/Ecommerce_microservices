import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: ["localhost:9094"],
});

const producer = kafka.producer();

// Create a consumer instance
const consumer = kafka.consumer({ groupId: "order-service" });

// Function to run the consumer
const run = async () => {
  try {
    // Connect the producer
    await producer.connect(); 
    // Connect the consumer
    await consumer.connect();
    // Subscribe to the topic
    await consumer.subscribe({
      topic: "payment-successful",
      fromBeginning: true,
    });
    // Listen for new messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log("Received message from Kafka at order_service:");
        const value = message.value.toString();
        const { userId, cart } = JSON.parse(value);

        // TODO: Create order on DB
        const dummyOrderId = "123456789";
        console.log(`Order consumer: Order created for order id: ${dummyOrderId}`);

        // Send order confirmation message to another topic
        await producer.send({
          topic: "order-successful",
          messages: [
            {
              value: JSON.stringify({
                orderId: dummyOrderId,
                userId,
              }),
            },
          ],
        });
      },
    });
  } catch (error) {
    console.error("Error in order service:", error);
  }
};

run();
