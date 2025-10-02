/**
 * Payment Service - Kafka Listener Microservice
 *
 * This microservice handles payment processing for an e-commerce platform using:
 * - Express.js for REST API endpoints
 * - CORS for cross-origin resource sharing
 * - Kafka for asynchronous message processing
 *
 * Architecture:
 * 1. Listens to Kafka topics for payment and refund requests
 * 2. Processes payments/refunds with simulated business logic
 * 3. Publishes results back to Kafka for other services to consume
 * 4. Provides HTTP endpoints for health checks and manual testing
 *
 * Kafka Topics:
 * - Consumes: payment-requests, refund-requests
 * - Produces: payment-results, refund-results
 */

import express from "express";
import cors from "cors";
import { Kafka } from "kafkajs";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003; // Default port 3003, configurable via environment

// Middleware Configuration
app.use(cors()); // Enable CORS for all routes - allows frontend to make requests
app.use(express.json()); // Parse JSON request bodies

/**
 * Kafka Configuration
 *
 * Creates Kafka client with:
 * - clientId: Unique identifier for this service instance
 * - brokers: Kafka cluster connection endpoints
 * - retry: Connection retry policy for resilience
 */
const kafka = Kafka({
  clientId: "payment-service",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"], // Configurable broker address
  retry: {
    initialRetryTime: 100, // Start with 100ms delay
    retries: 8, // Retry up to 8 times with exponential backoff
  },
});

/**
 * Kafka Consumer Configuration
 *
 * Consumer settings for reliable message processing:
 * - groupId: Consumer group for load balancing and fault tolerance
 * - sessionTimeout: Max time without heartbeat before rebalancing
 * - heartbeatInterval: Frequency of heartbeat signals to coordinator
 */
const consumer = kafka.consumer({
  groupId: "payment-service-group",
  sessionTimeout: 30000, // 30 seconds
  heartbeatInterval: 3000, // 3 seconds
});

/**
 * Service State Management
 *
 * Global state variables to track service health and lifecycle:
 * - isKafkaConnected: Monitors Kafka connection status for health checks
 * - isShuttingDown: Prevents duplicate shutdown procedures
 */
let isKafkaConnected = false;
let isShuttingDown = false;

/**
 * ========================================
 * PAYMENT PROCESSING BUSINESS LOGIC
 * ========================================
 */

/**
 * Process Payment Request
 *
 * Handles incoming payment requests from Kafka messages.
 * Simulates payment processing with configurable success rate.
 *
 * Message Flow:
 * 1. Receives payment request from 'payment-requests' topic
 * 2. Parses payment data (orderId, amount, etc.)
 * 3. Simulates payment processing (90% success rate)
 * 4. Publishes result to 'payment-results' topic
 *
 * @param {Object} message - Kafka message containing payment request
 * @param {Buffer} message.value - JSON stringified payment data
 */
const processPaymentRequest = async (message) => {
  try {
    // Parse the incoming payment request
    const paymentData = JSON.parse(message.value.toString());
    console.log("Processing payment request:", paymentData);

    // Simulate payment processing with 90% success rate
    // In production, this would integrate with payment gateways (Stripe, PayPal, etc.)
    const isSuccess = Math.random() > 0.1; // 90% success rate

    if (isSuccess) {
      console.log(
        `Payment processed successfully for order ${paymentData.orderId}`
      );

      // Publish successful payment result
      await publishPaymentResult({
        orderId: paymentData.orderId,
        paymentId: `payment_${Date.now()}`, // Generate unique payment ID
        status: "completed",
        amount: paymentData.amount,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`Payment failed for order ${paymentData.orderId}`);

      // Publish failed payment result
      await publishPaymentResult({
        orderId: paymentData.orderId,
        status: "failed",
        amount: paymentData.amount,
        error: "Payment processing failed",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error processing payment request:", error);
    // In production, you might want to publish an error event to Kafka
  }
};

/**
 * Process Refund Request
 *
 * Handles incoming refund requests from Kafka messages.
 * Simulates refund processing with higher success rate than payments.
 *
 * Message Flow:
 * 1. Receives refund request from 'refund-requests' topic
 * 2. Parses refund data (paymentId, amount, etc.)
 * 3. Simulates refund processing (95% success rate)
 * 4. Publishes result to 'refund-results' topic
 *
 * @param {Object} message - Kafka message containing refund request
 * @param {Buffer} message.value - JSON stringified refund data
 */
const processRefundRequest = async (message) => {
  try {
    // Parse the incoming refund request
    const refundData = JSON.parse(message.value.toString());
    console.log("Processing refund request:", refundData);

    // Simulate refund processing with 95% success rate
    // Refunds typically have higher success rates than initial payments
    const isSuccess = Math.random() > 0.05; // 95% success rate

    if (isSuccess) {
      console.log(
        `Refund processed successfully for payment ${refundData.paymentId}`
      );

      // Publish successful refund result
      await publishRefundResult({
        paymentId: refundData.paymentId,
        refundId: `refund_${Date.now()}`, // Generate unique refund ID
        status: "completed",
        amount: refundData.amount,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`Refund failed for payment ${refundData.paymentId}`);

      // Publish failed refund result
      await publishRefundResult({
        paymentId: refundData.paymentId,
        status: "failed",
        amount: refundData.amount,
        error: "Refund processing failed",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error processing refund request:", error);
    // In production, you might want to publish an error event to Kafka
  }
};

/**
 * ========================================
 * KAFKA MESSAGE PUBLISHING
 * ========================================
 */

// Kafka producer instance for publishing messages to other services
const producer = kafka.producer();

/**
 * Publish Payment Result
 *
 * Sends payment processing results to the 'payment-results' topic.
 * Other services (order-service, email-service) can consume these events.
 *
 * @param {Object} result - Payment processing result
 * @param {string} result.orderId - Original order identifier (used as message key)
 * @param {string} result.status - Payment status ('completed' or 'failed')
 * @param {number} result.amount - Payment amount
 * @param {string} [result.paymentId] - Generated payment ID (for successful payments)
 * @param {string} [result.error] - Error message (for failed payments)
 */
const publishPaymentResult = async (result) => {
  try {
    await producer.send({
      topic: "payment-results",
      messages: [
        {
          key: result.orderId, // Use orderId as partition key for ordered processing
          value: JSON.stringify(result),
          timestamp: Date.now().toString(),
        },
      ],
    });
    console.log("Payment result published:", result);
  } catch (error) {
    console.error("Error publishing payment result:", error);
    // In production, implement retry logic or dead letter queue
  }
};

/**
 * Publish Refund Result
 *
 * Sends refund processing results to the 'refund-results' topic.
 *
 * @param {Object} result - Refund processing result
 * @param {string} result.paymentId - Original payment identifier (used as message key)
 * @param {string} result.status - Refund status ('completed' or 'failed')
 * @param {number} result.amount - Refund amount
 * @param {string} [result.refundId] - Generated refund ID (for successful refunds)
 * @param {string} [result.error] - Error message (for failed refunds)
 */
const publishRefundResult = async (result) => {
  try {
    await producer.send({
      topic: "refund-results",
      messages: [
        {
          key: result.paymentId, // Use paymentId as partition key for ordered processing
          value: JSON.stringify(result),
          timestamp: Date.now().toString(),
        },
      ],
    });
    console.log("Refund result published:", result);
  } catch (error) {
    console.error("Error publishing refund result:", error);
    // In production, implement retry logic or dead letter queue
  }
};

/**
 * ========================================
 * KAFKA CONSUMER SETUP & MESSAGE HANDLING
 * ========================================
 */

/**
 * Setup Kafka Consumer
 *
 * Initializes Kafka consumer and producer connections, subscribes to topics,
 * and starts message processing loop. Implements automatic reconnection on failure.
 *
 * Connection Flow:
 * 1. Connect consumer and producer to Kafka cluster
 * 2. Subscribe to required topics (payment-requests, refund-requests)
 * 3. Start message consumption loop
 * 4. Route messages to appropriate processors based on topic
 * 5. Handle connection failures with automatic retry
 */
const setupKafkaConsumer = async () => {
  try {
    console.log("Connecting to Kafka...");

    // Establish connections to Kafka cluster
    await consumer.connect();
    await producer.connect();

    // Subscribe to payment and refund request topics
    // fromBeginning: false means only consume new messages
    await consumer.subscribe({
      topics: ["payment-requests", "refund-requests"],
      fromBeginning: false,
    });

    console.log("Subscribed to payment-requests and refund-requests topics");

    /**
     * Message Processing Loop
     *
     * Processes each message from subscribed topics:
     * - Routes to appropriate handler based on topic name
     * - Handles errors gracefully without stopping the consumer
     * - Logs message details for debugging and monitoring
     */
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          console.log(
            `Received message from topic: ${topic}, partition: ${partition}`
          );
          console.log(`Message: ${message.value.toString()}`);

          // Route message to appropriate processor based on topic
          switch (topic) {
            case "payment-requests":
              await processPaymentRequest(message);
              break;
            case "refund-requests":
              await processRefundRequest(message);
              break;
            default:
              console.log(`Unknown topic: ${topic}`);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Message processing errors don't stop the consumer
          // In production, you might want to send to dead letter queue
        }
      },
    });

    // Mark Kafka as connected for health checks
    isKafkaConnected = true;
    console.log("Kafka consumer is running...");
  } catch (error) {
    console.error("Error setting up Kafka consumer:", error);
    isKafkaConnected = false;

    // Automatic reconnection after 5 seconds
    // This provides resilience against temporary Kafka outages
    setTimeout(setupKafkaConsumer, 5000);
  }
};

/**
 * ========================================
 * HTTP API ENDPOINTS
 * ========================================
 */

/**
 * Health Check Endpoint
 *
 * Provides service health status for monitoring and load balancer health checks.
 * Returns JSON with service status, Kafka connection state, and uptime metrics.
 *
 * Response includes:
 * - service: Service name identifier
 * - status: Overall health status
 * - kafka.connected: Boolean indicating Kafka connectivity
 * - timestamp: Current server time
 * - uptime: Process uptime in seconds
 */
app.get("/health", (req, res) => {
  res.json({
    service: "payment-service",
    status: "healthy",
    kafka: {
      connected: isKafkaConnected,
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Service Status Endpoint
 *
 * Provides detailed service information including:
 * - Service version and configuration
 * - Kafka connection status and subscribed topics
 * - Available API endpoints documentation
 */
app.get("/status", (req, res) => {
  res.json({
    service: "payment-service",
    version: "1.0.0",
    kafka: {
      connected: isKafkaConnected,
      topics: ["payment-requests", "refund-requests"],
    },
    endpoints: ["GET /health - Health check", "GET /status - Service status"],
  });
});

/**
 * Manual Payment Processing Endpoint
 *
 * HTTP endpoint for testing payment processing without Kafka.
 * Useful for development, testing, and debugging.
 *
 * Request Body:
 * - orderId (required): Unique order identifier
 * - amount (required): Payment amount
 * - paymentMethod (optional): Payment method type (defaults to 'credit_card')
 *
 * This endpoint bypasses Kafka and directly calls the payment processing logic.
 */
app.post("/process-payment", async (req, res) => {
  try {
    const { orderId, amount, paymentMethod } = req.body;

    // Validate required fields
    if (!orderId || !amount) {
      return res.status(400).json({ error: "orderId and amount are required" });
    }

    // Create payment data structure matching Kafka message format
    const paymentData = {
      orderId,
      amount,
      paymentMethod: paymentMethod || "credit_card",
      timestamp: new Date().toISOString(),
    };

    // Process payment using the same logic as Kafka messages
    await processPaymentRequest({ value: JSON.stringify(paymentData) });

    res.json({
      message: "Payment processing initiated",
      orderId,
      amount,
    });
  } catch (error) {
    console.error("Error in manual payment processing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * ========================================
 * GRACEFUL SHUTDOWN & ERROR HANDLING
 * ========================================
 */

/**
 * Graceful Shutdown Handler
 *
 * Ensures clean service shutdown by:
 * 1. Preventing duplicate shutdown attempts
 * 2. Disconnecting from Kafka cleanly
 * 3. Closing HTTP server gracefully
 * 4. Forcing exit after timeout to prevent hanging
 *
 * This prevents data loss and ensures proper resource cleanup.
 */
const gracefulShutdown = async () => {
  if (isShuttingDown) return; // Prevent duplicate shutdown
  isShuttingDown = true;

  console.log("Initiating graceful shutdown...");

  try {
    // Disconnect from Kafka cluster cleanly
    if (isKafkaConnected) {
      await consumer.disconnect();
      await producer.disconnect();
      console.log("Kafka disconnected");
    }

    // Close HTTP server and stop accepting new connections
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log("Force exit");
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

/**
 * ========================================
 * PROCESS SIGNAL & ERROR HANDLERS
 * ========================================
 */

// Handle termination signals from process manager (PM2, Docker, etc.)
process.on("SIGTERM", gracefulShutdown); // Kubernetes/Docker shutdown
process.on("SIGINT", gracefulShutdown); // Ctrl+C

/**
 * Global Error Handlers
 *
 * Catch unhandled errors and exceptions to prevent service crashes:
 * - uncaughtException: Synchronous errors not caught by try/catch
 * - unhandledRejection: Promise rejections without .catch()
 *
 * Both trigger graceful shutdown to maintain service reliability.
 */
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown();
});

/**
 * ========================================
 * SERVICE INITIALIZATION
 * ========================================
 */

/**
 * Start Payment Service
 *
 * Service startup sequence:
 * 1. Start HTTP server on specified port
 * 2. Initialize Kafka consumer after server is ready
 * 3. Begin processing payment and refund requests
 *
 * The server starts first to ensure health checks work even if Kafka is unavailable.
 * Kafka connection is established after HTTP server is ready.
 */
const server = app.listen(PORT, async () => {
  console.log(`Payment service listening on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Service status at: http://localhost:${PORT}/status`);

  // Initialize Kafka consumer after HTTP server is ready
  await setupKafkaConsumer();
});

// Export the Express app for testing purposes
export default app;
