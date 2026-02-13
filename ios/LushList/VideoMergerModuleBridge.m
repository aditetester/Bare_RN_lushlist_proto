#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoMerger, NSObject)

RCT_EXTERN_METHOD(mergeVideos:(NSArray *)videoPaths
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
