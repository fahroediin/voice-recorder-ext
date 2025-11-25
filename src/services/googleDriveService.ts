// Google Drive API service for Chrome Extension

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
}

export interface UploadResult {
  folderId: string;
  folderLink: string;
  audioFile: GoogleDriveFile;
  notesFile: GoogleDriveFile;
}

class GoogleDriveService {
  private readonly BASE_URL = 'https://www.googleapis.com/upload/drive/v3';
  private readonly METADATA_URL = 'https://www.googleapis.com/drive/v3';

  /**
   * Get access token from Chrome Identity API
   */
  async getAccessToken(): Promise<string> {
    try {
      // Check if setup is complete first
      const result = await chrome.storage.local.get(['googleClientId']);
      if (!result.googleClientId) {
        throw new Error('Google Drive not configured. Please complete setup first.');
      }

      // Use Chrome Identity API to get OAuth token
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: ['https://www.googleapis.com/auth/drive.file']
          },
          (token) => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
            } else if (token) {
              resolve(token);
            } else {
              reject(new Error('No authentication token received'));
            }
          }
        );
      });
    } catch (error) {
      throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName: string): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken();

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      folderColorRgb: '#4285f4' // Blue color for voice recordings
    };

    const response = await fetch(`${this.METADATA_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create folder: ${error.error?.message || response.statusText}`);
    }

    const file = await response.json();
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink
    };
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    fileBlob: Blob,
    filename: string,
    parentFolderId: string
  ): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken();

    // Create multipart form data
    const form = new FormData();

    // Add metadata
    const metadata = {
      name: filename,
      parents: [parentFolderId]
    };

    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );

    // Add file content
    form.append('file', fileBlob);

    const response = await fetch(
      `${this.BASE_URL}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload file: ${error.error?.message || response.statusText}`);
    }

    const file = await response.json();
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink
    };
  }

  /**
   * Save a complete recording session to Google Drive
   */
  async saveSession(
    name: string,
    description: string,
    notesContent: string,
    audioBlob: Blob,
    duration: number
  ): Promise<UploadResult> {
    // Input validation
    if (!name || name.trim() === '') {
      throw new Error('Session name is required');
    }

    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Audio recording is required');
    }

    if (!audioBlob.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Expected audio file.');
    }
    try {
      // Create folder with date prefix
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const folderName = `${today} - ${name}`;

      console.log('Creating folder:', folderName);
      const folder = await this.createFolder(folderName);

      // Upload audio file
      const audioFileName = `recording.${this.getAudioExtension(audioBlob.type)}`;
      console.log('Uploading audio file:', audioFileName);
      const audioFile = await this.uploadFile(
        audioBlob,
        audioFileName,
        folder.id
      );

      // Create notes file content
      const notesHtml = this.createNotesHtml(name, description, notesContent, duration);
      const notesBlob = new Blob([notesHtml], { type: 'text/html' });

      console.log('Uploading notes file');
      const notesFile = await this.uploadFile(
        notesBlob,
        'meeting-notes.html',
        folder.id
      );

      const result: UploadResult = {
        folderId: folder.id,
        folderLink: folder.webViewLink || '',
        audioFile,
        notesFile
      };

      console.log('Session saved successfully:', result);
      return result;
    } catch (error) {
      console.error('Error saving session to Drive:', error);
      throw error;
    }
  }

  /**
   * Create HTML content for notes
   */
  private createNotesHtml(
    name: string,
    description: string,
    notesContent: string,
    duration: number
  ): string {
    const formattedDate = new Date().toLocaleString();
    const formattedDuration = this.formatDuration(duration);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} - Meeting Notes</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 28px;
            font-weight: 600;
            color: #2c3e50;
            margin: 0 0 10px 0;
        }
        .metadata {
            color: #6c757d;
            font-size: 14px;
        }
        .metadata-item {
            margin: 5px 0;
        }
        .description {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #007bff;
        }
        .notes-content {
            margin: 20px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 12px;
            color: #6c757d;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${name}</h1>
            <div class="metadata">
                <div class="metadata-item"><strong>Date:</strong> ${formattedDate}</div>
                <div class="metadata-item"><strong>Duration:</strong> ${formattedDuration}</div>
                ${description ? `<div class="metadata-item"><strong>Description:</strong> ${description}</div>` : ''}
            </div>
        </div>

        ${description ? `
        <div class="description">
            <strong>Description:</strong><br>
            ${description}
        </div>
        ` : ''}

        <div class="notes-content">
            <h3>Meeting Notes:</h3>
            ${notesContent || '<p style="color: #6c757d; font-style: italic;">No notes recorded</p>'}
        </div>

        <div class="footer">
            <p>Generated by Voice Recorder & Notes Chrome Extension</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get file extension from MIME type
   */
  private getAudioExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3'
    };

    return mimeToExt[mimeType] || 'webm';
  }

  /**
   * Format duration in seconds to human readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0 || hours > 0) {
      parts.push(`${minutes}m`);
    }

    parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
  }

  /**
   * Revoke authentication token
   */
  async revokeToken(): Promise<void> {
    const token = await this.getAccessToken();
    await chrome.identity.removeCachedAuthToken({ token });
  }
}

export const googleDriveService = new GoogleDriveService();