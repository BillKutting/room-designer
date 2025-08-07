# Room Designer

AI-powered room transformation application using ComfyUI for interior design and gaming background creation.

## Features

- **4-Step Process**: Upload → Inpaint → Prompt → Download
- **Drag & Drop Upload**: Easy image upload with preview
- **Interactive Inpainting**: Mark areas to remove/add furniture
- **Style Presets**: Quick selection for gaming, minimalist, cozy, modern, industrial, Scandinavian
- **Custom Prompts**: Detailed design descriptions
- **High-Resolution Output**: Ready for printing and sharing
- **ComfyUI Integration**: Powered by advanced AI image generation

## Quick Start

### Prerequisites
- Node.js 16+ 
- ComfyUI running at `http://192.168.1.193:8188/`

### Installation

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Start the application:**
   ```bash
   npm run dev
   ```

3. **Access the app:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## Usage

### Step 1: Upload
- Drag & drop or click to upload room image
- Supports JPG, PNG, WebP (max 10MB)

### Step 2: Inpaint
- Use brush tool (red) to mark areas to remove
- Use eraser tool (green) to mark areas to add
- Adjust brush size as needed
- Clear canvas to start over

### Step 3: Prompt
- Choose from style presets or write custom prompt
- Be specific about colors, furniture, lighting, mood
- Click "Generate Design" to process

### Step 4: Download
- Preview your AI-generated room design
- Download high-resolution image
- Share with friends and family

## API Endpoints

- `POST /api/upload` - Upload image
- `POST /api/comfyui/queue` - Queue ComfyUI workflow
- `GET /api/comfyui/history/:promptId` - Get generation history
- `GET /api/comfyui/status` - Check ComfyUI status

## Project Structure

```
room-designer/
├── server.js              # Express backend
├── package.json           # Backend dependencies
├── uploads/              # Uploaded images
├── outputs/              # Generated images
└── client/               # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── ImageUpload.js
    │   │   ├── InpaintEditor.js
    │   │   ├── PromptEditor.js
    │   │   └── ResultViewer.js
    │   └── App.js
    └── package.json
```

## ComfyUI Integration

The app connects to ComfyUI at `http://192.168.1.193:8188/` for:
- Inpainting workflows
- Image generation
- Style transfer
- Upscaling

## Development

### Backend
```bash
npm run server
```

### Frontend
```bash
cd client && npm start
```

### Both
```bash
npm run dev
```

## TODO

- [ ] Add ComfyUI workflow JSON integration
- [ ] Implement actual inpainting with mask data
- [ ] Add upscaling options
- [ ] Save/load project functionality
- [ ] Batch processing
- [ ] User accounts and history

## License

MIT License # room-designer
