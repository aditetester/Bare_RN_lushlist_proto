package com.lushlist.proto

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray

import android.media.*
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

class VideoMergerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "VideoMerger"
    }

    @ReactMethod
    fun mergeVideos(videoPaths: ReadableArray, outputPath: String, promise: Promise) {
        try {
            val paths = mutableListOf<String>()
            for (i in 0 until videoPaths.size()) {
                videoPaths.getString(i)?.let { paths.add(it) }
            }

            if (paths.isEmpty()) {
                promise.reject("EMPTY_PATHS", "No video paths provided")
                return
            }

            if (paths.size == 1) {
                promise.resolve(paths[0])
                return
            }

            val outputFile = File(outputPath)
            if (outputFile.exists()) {
                outputFile.delete()
            }

            val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            
            var videoTrackIndex = -1
            var audioTrackIndex = -1
            
            var videoFormat: MediaFormat? = null
            var audioFormat: MediaFormat? = null
            
            val extractors = mutableListOf<MediaExtractor>()
            
            // First pass: find formats and add tracks
            val firstExtractor = MediaExtractor()
            firstExtractor.setDataSource(paths[0])
            
            for (i in 0 until firstExtractor.trackCount) {
                val format = firstExtractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME)
                if (mime?.startsWith("video/") == true && videoTrackIndex == -1) {
                    videoFormat = format
                    videoTrackIndex = muxer.addTrack(format)
                } else if (mime?.startsWith("audio/") == true && audioTrackIndex == -1) {
                    audioFormat = format
                    audioTrackIndex = muxer.addTrack(format)
                }
            }
            firstExtractor.release()
            
            muxer.start()
            
            var videoOffset: Long = 0
            var audioOffset: Long = 0
            
            val buffer = ByteBuffer.allocate(1024 * 1024)
            val bufferInfo = MediaCodec.BufferInfo()
            
            for (path in paths) {
                val extractor = MediaExtractor()
                extractor.setDataSource(path)
                
                var currentVideoTrack = -1
                var currentAudioTrack = -1
                
                for (i in 0 until extractor.trackCount) {
                    val format = extractor.getTrackFormat(i)
                    val mime = format.getString(MediaFormat.KEY_MIME)
                    if (mime?.startsWith("video/") == true) {
                        currentVideoTrack = i
                        extractor.selectTrack(i)
                    } else if (mime?.startsWith("audio/") == true) {
                        currentAudioTrack = i
                        extractor.selectTrack(i)
                    }
                }
                
                var segmentVideoStartTime: Long = -1
                var segmentAudioStartTime: Long = -1
                var segmentMaxVideoPts: Long = 0
                var segmentMaxAudioPts: Long = 0
                
                while (true) {
                    val trackIndex = extractor.sampleTrackIndex
                    if (trackIndex == -1) break
                    
                    val size = extractor.readSampleData(buffer, 0)
                    if (size < 0) break
                    
                    val sampleTime = extractor.sampleTime
                    val flags = extractor.sampleFlags
                    
                    bufferInfo.size = size
                    bufferInfo.offset = 0
                    bufferInfo.flags = flags
                    
                    if (trackIndex == currentVideoTrack && videoTrackIndex != -1) {
                        if (segmentVideoStartTime == -1L) segmentVideoStartTime = sampleTime
                        
                        val pts = videoOffset + (sampleTime - segmentVideoStartTime)
                        bufferInfo.presentationTimeUs = pts
                        muxer.writeSampleData(videoTrackIndex, buffer, bufferInfo)
                        segmentMaxVideoPts = Math.max(segmentMaxVideoPts, pts)
                    } else if (trackIndex == currentAudioTrack && audioTrackIndex != -1) {
                        if (segmentAudioStartTime == -1L) segmentAudioStartTime = sampleTime
                        
                        val pts = audioOffset + (sampleTime - segmentAudioStartTime)
                        bufferInfo.presentationTimeUs = pts
                        muxer.writeSampleData(audioTrackIndex, buffer, bufferInfo)
                        segmentMaxAudioPts = Math.max(segmentMaxAudioPts, pts)
                    }
                    
                    extractor.advance()
                }
                
                // Set offsets for next segment based on max PTS found in this segment
                // Add a small constant (e.g. 1ms) to ensure no overlap if needed, though strictly continuous is better
                videoOffset = segmentMaxVideoPts + 33333 // Approx 1 frame at 30fps
                audioOffset = segmentMaxAudioPts + 20000 // Approx 1 frame for audio
                
                extractor.release()
            }
            
            muxer.stop()
            muxer.release()
            
            promise.resolve(outputPath)
            
        } catch (e: Exception) {
            Log.e("VideoMerger", "Error merging videos", e)
            promise.reject("MERGE_ERROR", e.message)
        }
    }
}
