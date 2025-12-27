import { createClient } from '@/lib/supabase/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const BUCKET_NAME = 'task-images'

export interface TaskImage {
  id: string
  task_id: string
  user_id: string
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  created_at: string
  url?: string
}

// Get image dimensions
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

// Compress image if needed
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
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      resolve(file)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

export interface UploadTaskImageResult {
  success: boolean
  url?: string
  storagePath?: string
  error?: string
  taskImage?: TaskImage
}

export async function uploadTaskImage(
  file: File,
  taskId: string,
  onProgress?: (progress: number) => void
): Promise<UploadTaskImageResult> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.map(t => t.split('/')[1]).join(', ')}`
    }
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: 'File too large. Maximum size is 5MB'
    }
  }

  const supabase = createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      success: false,
      error: 'User not authenticated'
    }
  }

  // Compress image if needed (for large images)
  onProgress?.(10)
  let processedFile = file
  if (file.size > 1024 * 1024) { // If larger than 1MB
    processedFile = await compressImage(file, 1200)
  }
  onProgress?.(30)

  // Get image dimensions
  const dimensions = await getImageDimensions(processedFile)
  onProgress?.(40)

  // Generate unique filename
  const fileExt = processedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const fileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`

  try {
    // Check if task already has an image (single image per task)
    const { data: existingImage } = await supabase
      .from('task_images')
      .select('storage_path')
      .eq('task_id', taskId)
      .single()

    // Delete existing image if present
    if (existingImage?.storage_path) {
      await supabase.storage.from(BUCKET_NAME).remove([existingImage.storage_path])
      await supabase.from('task_images').delete().eq('task_id', taskId)
    }
    onProgress?.(50)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, processedFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      }
    }
    onProgress?.(70)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    // Save metadata to task_images table
    const { data: imageRecord, error: dbError } = await supabase
      .from('task_images')
      .insert({
        task_id: taskId,
        user_id: user.id,
        storage_path: uploadData.path,
        file_name: file.name,
        file_size: processedFile.size,
        mime_type: processedFile.type,
        width: dimensions.width,
        height: dimensions.height,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([uploadData.path])
      return {
        success: false,
        error: `Failed to save image metadata: ${dbError.message}`
      }
    }
    onProgress?.(100)

    return {
      success: true,
      url: urlData.publicUrl,
      storagePath: uploadData.path,
      taskImage: { ...imageRecord, url: urlData.publicUrl }
    }
  } catch (error) {
    console.error('Error uploading task image:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function deleteTaskImage(taskId: string): Promise<boolean> {
  const supabase = createClient()

  try {
    // Get the image record
    const { data: imageRecord, error: fetchError } = await supabase
      .from('task_images')
      .select('storage_path')
      .eq('task_id', taskId)
      .single()

    if (fetchError || !imageRecord) {
      console.log('No image found for task:', taskId)
      return true // No image to delete
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([imageRecord.storage_path])

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('task_images')
      .delete()
      .eq('task_id', taskId)

    if (dbError) {
      console.error('Error deleting from database:', dbError)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteTaskImage:', error)
    return false
  }
}

export async function getTaskImage(taskId: string): Promise<TaskImage | null> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('task_images')
      .select('*')
      .eq('task_id', taskId)
      .single()

    if (error || !data) {
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.storage_path)

    return {
      ...data,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('Error fetching task image:', error)
    return null
  }
}

export async function getTaskImages(taskIds: string[]): Promise<Map<string, TaskImage>> {
  const supabase = createClient()
  const imageMap = new Map<string, TaskImage>()

  if (taskIds.length === 0) return imageMap

  try {
    const { data, error } = await supabase
      .from('task_images')
      .select('*')
      .in('task_id', taskIds)

    if (error || !data) {
      return imageMap
    }

    // Get public URLs for all images
    for (const image of data) {
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(image.storage_path)

      imageMap.set(image.task_id, {
        ...image,
        url: urlData.publicUrl
      })
    }

    return imageMap
  } catch (error) {
    console.error('Error fetching task images:', error)
    return imageMap
  }
}
