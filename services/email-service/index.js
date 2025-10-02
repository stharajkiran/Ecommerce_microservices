import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "email-service",
  brokers: ["localhost:9094"],
});

const producer = kafka.producer();

// Create a consumer instance
const consumer = kafka.consumer({ groupId: "email-service" });

// Function to run the consumer
const run = async () => {
  try {
    // Connect the producer
    await producer.connect(); 
    // Connect the consumer
    await consumer.connect();
    // Subscribe to the topic
    await consumer.subscribe({
      topic: "order-successful",
      fromBeginning: true,
    });
    // Listen for new messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value.toString();
        console.log("Received message from Kafka at email_service:", value);

        const { userId, orderId } = JSON.parse(value);

        // TODO: Send email to user
        const dummyEmailId = "98745";
        console.log(`Email service: Sending email to user id: ${dummyEmailId} for order id: ${orderId}`);

        // Send order confirmation message to another topic
        await producer.send({
          topic: "email-successful",
          messages: [
            {
              value: JSON.stringify({
                userId,
                email: dummyEmailId,
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
