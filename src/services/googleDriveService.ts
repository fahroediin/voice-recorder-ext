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
      console.log('Requesting Google Drive authentication token...');

      // Use Chrome Identity API (Client ID is in manifest)
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: ['https://www.googleapis.com/auth/drive.file']
          },
          (token) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome Identity API error:', chrome.runtime.lastError);

              // Provide helpful error messages
              if (chrome.runtime.lastError.message?.includes('OAuth2') || chrome.runtime.lastError.message?.includes('Client ID')) {
                reject(new Error('Google Drive authentication failed. Please ensure:\n1. Extension has a valid Google Client ID in manifest\n2. Client ID is configured for Chrome Application\n3. Google Drive API is enabled'));
              } else {
                reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
              }
            } else if (token) {
              console.log('✅ Successfully received Google Drive auth token');
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

      // Create notes file content (plain text)
      const notesText = this.createNotesText(name, description, notesContent, duration);
      const notesBlob = new Blob([notesText], { type: 'text/plain' });

      console.log('Uploading notes file');
      const notesFile = await this.uploadFile(
        notesBlob,
        'meeting-notes.txt',
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
   * Create plain text content for notes
   */
  private createNotesText(
    name: string,
    description: string,
    notesContent: string,
    duration: number
  ): string {
    const formattedDate = new Date().toLocaleString();
    const formattedDuration = this.formatDuration(duration);

    return `
===============================================
${name}
===============================================

📅 Date: ${formattedDate}
⏱️ Duration: ${formattedDuration}
${description ? `📝 Description: ${description}` : ''}

-----------------------------------------------
MEETING NOTES
-----------------------------------------------

${notesContent || 'No notes recorded'}

-----------------------------------------------
Generated by Voice Recorder & Notes Chrome Extension
Recording Duration: ${formattedDuration}
Saved on: ${formattedDate}
===============================================
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