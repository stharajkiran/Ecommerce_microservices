import { Kafka } from "kafkajs";

// Initialize Kafka client with connection configuration
const kafka = new Kafka({
  clientId: "kafka-service", // Unique identifier for this Kafka client instance
  brokers: ["localhost:9094"], // Kafka broker addresses - matches docker-compose PLAINTEXT_HOST listener
});

// Create admin client for cluster management operations
// Admin client allows us to create/delete topics, manage partitions, etc.
const admin = kafka.admin();

/**
 * Main function to set up Kafka topics for the ecommerce microservices
 * Creates essential topics that will be used for inter-service communication
 */
const run = async () => {
  try {
    // Connect to Kafka cluster
    console.log("Connecting to Kafka cluster...");
    await admin.connect();

    // Create topics for microservices communication
    // These topics will handle events flowing between different services
    console.log("Creating Kafka topics...");
    await admin.createTopics({
      topics: [
        {
          topic: "payment-successful", // Topic for payment service to publish successful payment events
          numPartitions: 1, // Single partition for simplicity (can be increased for scaling)
          replicationFactor: 1, // Single replica since we have only one broker
        },
        {
          topic: "order-successful", // Topic for order service to publish successful order events
          numPartitions: 1,
          replicationFactor: 1,
        },
        {
          topic: "email-successful", // Topic for email service to publish email sent confirmations
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    console.log("Topics created successfully!");

    // List all topics to verify creation
    const topics = await admin.listTopics();
    console.log("Available topics:", topics);
  } catch (error) {
    console.error("Error setting up Kafka topics:", error);
  } finally {
    // Always disconnect to clean up resources
    await admin.disconnect();
    console.log("Disconnected from Kafka cluster");
  }
};

// Execute the setup
run();
