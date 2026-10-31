import Foundation
import CoreGraphics
import ImageIO
import CoreText
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let courses=try JSONSerialization.jsonObject(with:Data(contentsOf:root.appendingPathComponent("metrics.json"))) as! [[String:Any]]
for (view,name) in [(1,"onboard"),(2,"landmarks"),(3,"overview")] {
  let width=1600,height=7*255
  let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(red:0.07,green:0.13,blue:0.15,alpha:1));ctx.fill(CGRect(x:0,y:0,width:width,height:height))
  for (i,course) in courses.enumerated() {
    let id=course["id"] as! String,x=i%4*400,y=height-(i/4+1)*255
    let src=CGImageSourceCreateWithURL(root.appendingPathComponent("\(id)/view-\(view).jpg") as CFURL,nil)!
    ctx.draw(CGImageSourceCreateImageAtIndex(src,0,nil)!,in:CGRect(x:x,y:y,width:400,height:225))
    let text=NSAttributedString(string:id,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):CTFontCreateWithName("Helvetica" as CFString,17,nil),NSAttributedString.Key(kCTForegroundColorAttributeName as String):CGColor(gray:0.94,alpha:1)])
    ctx.textPosition=CGPoint(x:x+8,y:y+232);CTLineDraw(CTLineCreateWithAttributedString(text),ctx)
  }
  let output=CGImageDestinationCreateWithURL(root.appendingPathComponent("\(name)-contact.jpg") as CFURL,"public.jpeg" as CFString,1,nil)!
  CGImageDestinationAddImage(output,ctx.makeImage()!,[kCGImageDestinationLossyCompressionQuality:0.88] as CFDictionary);CGImageDestinationFinalize(output)
}
