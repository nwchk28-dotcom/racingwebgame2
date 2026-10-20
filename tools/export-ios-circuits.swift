import Foundation
@main struct ExportWeb {
 static func main() throws {
  let root=URL(fileURLWithPath:CommandLine.arguments[1]),output=URL(fileURLWithPath:CommandLine.arguments[2])
  for file in try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil).filter({$0.pathExtension=="json"}) {
   let c=try Circuit.load(file)
   let surface=c.data.distances.map { d -> [Double] in
    let s=c.terrain!.sample(distance:d)
    return [s.height,s.grade,s.bank,s.bankRate]
   }
   var data=try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as! [String:Any]
   data["surface"]=surface
   data["corridor"]=try JSONSerialization.jsonObject(with:Data(contentsOf:file.deletingPathExtension().appendingPathExtension("corridor")))
   try JSONSerialization.data(withJSONObject:data,options:[.sortedKeys]).write(to:output.appendingPathComponent(file.lastPathComponent))
  }
 }
}
