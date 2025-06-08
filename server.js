const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const app = express()
const PORT = process.env.PORT || 3000

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Create submissions.csv if it doesn't exist
const csvFile = path.join(__dirname, "submissions.csv")
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, "Username,Filename,Date\n")
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    // Create filename with timestamp + original name
    const timestamp = Date.now()
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")
    cb(null, `${timestamp}_${sanitizedOriginalName}`)
  },
})

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png"]
  const fileExtension = path.extname(file.originalname).toLowerCase()

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only PDF, JPG, and PNG files are allowed."), false)
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
})

// Middleware
app.use(express.static("public"))
app.use(express.urlencoded({ extended: true }))

// Function to sanitize input
function sanitizeInput(input) {
  return input.replace(/[<>"'&]/g, "").trim()
}

// Function to log submission to CSV
function logSubmission(username, filename) {
  const date = new Date().toISOString().split("T")[0] // YYYY-MM-DD format
  const csvLine = `"${username}","${filename}","${date}"\n`

  fs.appendFile(csvFile, csvLine, (err) => {
    if (err) {
      console.error("Error writing to CSV:", err)
    } else {
      console.log("Submission logged to CSV successfully")
    }
  })
}

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.post("/upload", upload.single("userFile"), (req, res) => {
  try {
    // Sanitize username input
    const username = sanitizeInput(req.body.username || "")

    if (!username) {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
          <h2 style="color: #e74c3c;">Error</h2>
          <p>Username is required.</p>
          <a href="/" style="color: #3498db; text-decoration: none;">← Go back</a>
        </div>
      `)
    }

    if (!req.file) {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
          <h2 style="color: #e74c3c;">Error</h2>
          <p>No file was uploaded.</p>
          <a href="/" style="color: #3498db; text-decoration: none;">← Go back</a>
        </div>
      `)
    }

    // Log to console
    console.log(`File uploaded by: ${username}`)
    console.log(`Original filename: ${req.file.originalname}`)
    console.log(`Stored as: ${req.file.filename}`)
    console.log(`File size: ${(req.file.size / 1024).toFixed(2)} KB`)
    console.log("---")

    // Log to CSV
    logSubmission(username, req.file.originalname)

    // Send success response
    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
        <h2 style="color: #27ae60;">✅ Success!</h2>
        <p style="font-size: 18px; margin: 20px 0;">
          File uploaded successfully, thank you <strong>${username}</strong>!
        </p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>File:</strong> ${req.file.originalname}</p>
          <p><strong>Size:</strong> ${(req.file.size / 1024).toFixed(2)} KB</p>
          <p><strong>Upload Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <a href="/" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
          Upload Another File
        </a>
      </div>
    `)
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
        <h2 style="color: #e74c3c;">Error</h2>
        <p>An error occurred during upload. Please try again.</p>
        <a href="/" style="color: #3498db; text-decoration: none;">← Go back</a>
      </div>
    `)
  }
})

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
          <h2 style="color: #e74c3c;">File Too Large</h2>
          <p>File size must be less than 5MB.</p>
          <a href="/" style="color: #3498db; text-decoration: none;">← Go back</a>
        </div>
      `)
    }
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
        <h2 style="color: #e74c3c;">Invalid File Type</h2>
        <p>Only PDF, JPG, and PNG files are allowed.</p>
        <a href="/" style="color: #3498db; text-decoration: none;">← Go back</a>
      </div>
    `)
  }

  next(error)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📁 Files will be stored in: ${uploadsDir}`)
  console.log(`📊 Submissions logged to: ${csvFile}`)
})
