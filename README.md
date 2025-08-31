# README.md

# Carpool Backend

This project is a backend application for a carpool system, built with Node.js, TypeScript, and Express. It provides robust authentication and security features, profile and permission management, privacy and data administration, ride and vehicle management, chat and communication, push notifications, and real-time location sharing. The application is structured to run in Docker containers using Docker Compose.

## Features

- **Authentication**: Secure user registration, login, and password recovery with JWT.
- **User Management**: Profile management, including viewing, editing, and approving registrations.
- **Ride Management**: Create, update, and cancel rides.
- **Vehicle Management**: Add and validate vehicle information.
- **Chat Functionality**: Send and retrieve messages between users.
- **Push Notifications**: Manage user preferences for notifications.
- **Real-Time Location Sharing**: Share location updates in real-time.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- Docker and Docker Compose

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd carpool-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` and fill in the required values.

4. Run the application using Docker Compose:
   ```bash
   docker-compose up
   ```

### Running Tests

To run the unit and integration tests, use the following command:
```bash
npm test
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- [Express.js](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [MongoDB](https://www.mongodb.com/)
- [Docker](https://www.docker.com/)