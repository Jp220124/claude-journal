import { createClient } from '@/lib/supabase/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_BASE64_SIZE = 2 * 1024 * 1024 // 2MB for base64 (to keep note content reasonable)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Convert file to base64 data URL
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Compress image if needed (for base64 storage)
async function compressImage(file: File, maxWidth: number = 1200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let { width, height } = img

      // Only resize if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        0.85 // Quality
      )
    }

    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadNoteImage(file: File, noteId?: string): Promise<string | null> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.error('Invalid file type. Allowed types:', ALLOWED_TYPES.join(', '))
    return null
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    console.error('File too large. Maximum size is 5MB')
    return null
  }

  const supabase = createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('User not authenticated')
    // Fall back to base64 for unauthenticated users (demo mode)
    return await convertToBase64WithCompression(file)
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const fileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`

  try {
    // Try to upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('note-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.warn('Supabase Storage upload failed, using base64 fallback:', error.message)
      return await convertToBase64WithCompression(file)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('note-images')
      .getPublicUrl(data.path)

    // Verify the URL is accessible (bucket might not be public)
    try {
      const response = await fetch(urlData.publicUrl, { method: 'HEAD' })
      if (!response.ok) {
        console.warn('Supabase Storage URL not accessible, using base64 fallback')
        // Clean up the uploaded file since we can't access it
        await supabase.storage.from('note-images').remove([data.path])
        return await convertToBase64WithCompression(file)
      }
    } catch {
      console.warn('Could not verify Supabase Storage URL, using base64 fallback')
      return await convertToBase64WithCompression(file)
    }

    // Optionally save to note_images table for tracking
    if (noteId) {
      try {
        await supabase.from('note_images').insert({
          user_id: user.id,
          note_id: noteId,
          storage_path: data.path,
          filename: file.name,
          size_bytes: file.size,
          mime_type: file.type,
        })
      } catch {
        // Ignore table errors - table might not exist
      }
    }

    return urlData.publicUrl
  } catch (error) {
    console.warn('Error in Supabase upload, using base64 fallback:', error)
    return await convertToBase64WithCompression(file)
  }
}

// Helper function to convert file to base64 with compression
async function convertToBase64WithCompression(file: File): Promise<string | null> {
  try {
    let processedFile = file

    // Compress if file is too large for base64
    if (file.size > MAX_BASE64_SIZE) {
      console.log('Compressing image for base64 storage...')
      processedFile = await compressImage(file, 1000)
    }

    const base64 = await fileToBase64(processedFile)
    console.log('Image converted to base64 successfully')
    return base64
  } catch (error) {
    console.error('Error converting to base64:', error)
    return null
  }
}

export async function deleteNoteImage(storagePath: string): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.storage
      .from('note-images')
      .remove([storagePath])

    if (error) {
      console.error('Error deleting image:', error)
      return false
    }

    // Also delete from note_images table
    await supabase
      .from('note_images')
      .delete()
      .eq('storage_path', storagePath)

    return true
  } catch (error) {
    console.error('Error in image deletion:', error)
    return false
  }
}

export async function getNoteImages(noteId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('note_images')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching note images:', error)
    return []
  }

  return data || []
}
