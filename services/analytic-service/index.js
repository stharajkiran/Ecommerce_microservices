import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "analytic-service",
  brokers: ["localhost:9094"],
});

// Create a consumer instance
const consumer = kafka.consumer({ groupId: "analytic-service" });

// Function to run the consumer
const run = async () => {
  try {
    // Connect the consumer
    await consumer.connect();
    // Subscribe to the topic
    await consumer.subscribe({
      topics: ["payment-successful", "order-successful", "email-successful"],
      fromBeginning: true,
    });
    // Listen for new messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        switch (topic) {
          case "payment-successful":
            const value = message.value.toString();
            const { userId, cart } = JSON.parse(value);
            const total = cart
              .reduce((acc, item) => acc + item.price, 0)
              .toFixed(2);
            console.log(
              `Analytic Consumer: User ${userId} made a payment of $${total}`
            );
            break;
          case "order-successful":
            {
              const value = message.value.toString();
              const { userId, orderId } = JSON.parse(value);

              console.log(
                `Analytic consumer: Order id ${orderId} created for user id ${userId}`
              );
            }
            break;
          case "email-successful":
            {
              const value = message.value.toString();
              const { userId, emailId } = JSON.parse(value);

              console.log(
                `Analytic consumer: Email id ${emailId} sent to user id ${userId}`
              );
            }
            break;
        }
      },
    });
  } catch (error) {
    console.error("Error in analytic service:", error);
  }
};

run();
