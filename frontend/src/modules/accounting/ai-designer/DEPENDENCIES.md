# AI Designer Dependencies

## Required NPM Packages

The following package needs to be added to your frontend `package.json`:

### Primary Dependency

```json
{
  "dependencies": {
    "@google/genai": "^1.30.0"
  }
}
```

### Already Available

These dependencies are already available in the ERP03 frontend:

- ✅ `react`: ^18.2.0 (ai-designer uses ^19.2.0, but should be compatible)
- ✅ `react-dom`: ^18.2.0 (ai-designer uses ^19.2.0, but should be compatible)
- ✅ `lucide-react`: ^0.559.0 (ai-designer uses ^0.554.0, compatible)

## Installation

To install the missing dependency, run:

```bash
cd frontend
npm install @google/genai
```

## Configuration

The Gemini service requires an API key. You'll need to:

1. Get a Gemini API key from Google AI Studio
2. Configure it in your environment variables
3. Update the service to read from your environment configuration

### Original Configuration

In the original ai-designer, the API key was stored in `.env.local`:

```
GEMINI_API_KEY=your_api_key_here
```

### ERP03 Integration

You may want to integrate this with your existing environment configuration system.

## Notes

- The React version difference (18.2.0 vs 19.2.0) should not cause issues for these components
- All other dependencies are already satisfied
- The `@google/genai` package is only used by the `geminiService.ts` for AI-powered schema generation
