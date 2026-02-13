import Foundation
import AVFoundation
import React

@objc(VideoMerger)
class VideoMerger: NSObject {
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    @objc(mergeVideos:outputPath:resolver:rejecter:)
    func mergeVideos(videoPaths: [String], outputPath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        
        let composition = AVMutableComposition()
        guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            reject("COMPOSITION_ERROR", "Could not create composition tracks", nil)
            return
        }
        
        var currentTime = CMTime.zero
        
        for path in videoPaths {
            let url = URL(fileURLWithPath: path)
            let asset = AVURLAsset(url: url)
            
            let videoAssets = asset.tracks(withMediaType: .video)
            let audioAssets = asset.tracks(withMediaType: .audio)
            
            if videoAssets.isEmpty { continue }
            
            let assetVideoTrack = videoAssets[0]
            let duration = assetVideoTrack.timeRange.duration
            
            do {
                try videoTrack.insertTimeRange(CMTimeRangeMake(start: .zero, duration: duration), of: assetVideoTrack, at: currentTime)
                
                if !audioAssets.isEmpty {
                    try audioTrack.insertTimeRange(CMTimeRangeMake(start: .zero, duration: duration), of: audioAssets[0], at: currentTime)
                }
                
                currentTime = CMTimeAdd(currentTime, duration)
            } catch {
                reject("MERGE_ERROR", "Error inserting track: \(error.localizedDescription)", error)
                return
            }
        }
        
        let outputURL = URL(fileURLWithPath: outputPath)
        if FileManager.default.fileExists(atPath: outputPath) {
            try? FileManager.default.removeItem(at: outputURL)
        }
        
        guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
            reject("EXPORT_ERROR", "Could not create export session", nil)
            return
        }
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true
        
        exportSession.exportAsynchronously {
            switch exportSession.status {
            case .completed:
                resolve(outputPath)
            case .failed:
                reject("EXPORT_FAILED", exportSession.error?.localizedDescription ?? "Unknown error", exportSession.error)
            case .cancelled:
                reject("EXPORT_CANCELLED", "Export cancelled", nil)
            default:
                reject("EXPORT_ERROR", "Unknown export status", nil)
            }
        }
    }
}
