# Interactive Universe Sound Website

An interactive web application that lets kids talk with celestial objects and natural elements, creating an engaging educational experience. The application uses AI to generate context-aware responses and converts them to speech, making learning fun and interactive.

## Features

- **Interactive Objects**: Talk with the Moon, Sun, Rock, and Tree
- **Age-Appropriate Responses**: Customized content for different age groups (5 and 10 years old)
- **Voice Interaction**: 
  - Voice input for questions
  - AI-generated voice responses
  - Real-time audio visualization
- **User Authentication**: Secure signup/signin system
- **Responsive Design**: Works on both desktop and mobile devices

## Technology Stack

- **Backend**: 
  - Flask (Python web framework)
  - SQLite (User authentication database)
  - OpenAI API (Natural language processing)
  - ElevenLabs API (Text-to-speech conversion)

- **Frontend**:
  - HTML5/CSS3
  - Tailwind CSS
  - Vanilla JavaScript
  - Web Audio API
  - Canvas API for visualizations

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   - OPENAI_API_KEY
   - ELEVENLABS_API_KEY
   - DATABASE_URL

4. Initialize the database:
   ```bash
   python init_db.py
   ```

5. Run the application:
   ```bash
   python main.py
   ```

## Usage Guide

1. Sign up for an account or sign in if you already have one
2. Select the age group (5 or 10 years old)
3. Click on any object (Moon, Sun, Rock, or Tree) to start a conversation
4. Click the Audio button to start speaking
5. Wait for the AI response
6. Click "End Call" to finish the conversation

## iOS Compatibility Notes

For the best experience on iOS devices:
1. Use Safari browser
2. Enable "Request Desktop Site" in Safari settings
3. Allow microphone access when prompted

## Special Features

- **Real-time Audio Visualization**: Visual feedback during conversations
- **Age-Appropriate Content**: Different response styles for different age groups
- **Interactive Interface**: iPhone-style call interface for conversations
- **Responsive Design**: Adapts to different screen sizes

## Note

This is an educational project designed to make learning about the universe and nature more engaging for children. The responses are generated using AI and are designed to be both educational and age-appropriate.
