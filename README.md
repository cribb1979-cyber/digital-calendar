# Digital Calendar App

A web application for managing a fully digital calendar with voice input capabilities. Users can speak their events, and the app will automatically schedule them, ask for clarification on times, and provide reminders.

## Features

- Voice-to-text event creation using Web Speech API
- Natural language processing for extracting event details (title, time, date)
- Interactive confirmation dialogs for ambiguous time expressions
- Reminder system (browser notifications, email/SMS optional)
- Responsive design for mobile and desktop
- Data persistence (localStorage or backend database)

## Tech Stack

- Frontend: React (or similar) with Web Speech API
- Backend: Node.js/Express (optional for persistent storage and reminder scheduling)
- Database: SQLite / MongoDB / Firebase (to be decided)
- Real-time updates: WebSocket or polling (optional)

## Getting Started

```bash
# Clone the repository
git clone <repository-url>
cd digital-calendar

# Install dependencies (if using separate client/server)
cd client && npm install
cd ../server && npm install

# Start development servers
# In one terminal: cd client && npm run dev
# In another terminal: cd server && npm run dev
```

## Project Structure

```
digital-calendar/
├── client/           # Frontend application
├── server/           # Backend API and services
├── README.md
├── .gitignore
└── package.json      # Optional root package.json for workspace management
```

## Voice Input

The app uses the Web Speech API (`window.SpeechRecognition` or `webkitSpeechRecognition`) to capture voice input and convert it to text. The text is then processed to extract event details.

## Reminders

Reminders are implemented using the Notifications API and/or background sync (service workers) for timely alerts even when the app is not open.

## Contributing

Feel free to open issues or submit pull requests to improve the app.

## License

MIT