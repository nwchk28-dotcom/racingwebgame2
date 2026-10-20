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
   let field=c.terrainGround!,corridor=c.drivingCorridor!
   var terrain:[String:Any]=[
     "minX":field.minX,"minZ":field.minZ,"spacing":field.spacing,
     "columns":field.columns,"rows":field.rows,"baseHeight":field.baseHeight,
     "heights":(0..<field.rows).flatMap { row in (0..<field.columns).map { column in field.vertexHeight(column:column,row:row) } }
   ]
   for side in [-1.0,1.0] {
     let outer=side>0 ? corridor.sceneryLeft:corridor.sceneryRight
     terrain[side>0 ? "sceneryLeft":"sceneryRight"]=(0..<c.points.count).map { i -> [Double] in
       let p=c.points[i]+c.normals[i]*(side*outer[i])
       return [p.x,field.height(at:p),p.z]
     }
   }
   if c.data.id=="suzuka" { terrain["bridgeRange"]=[SuzukaTerrain.bridgeRange.lowerBound,SuzukaTerrain.bridgeRange.upperBound] }
   terrain["fenceHeights"]=(0...512).map { i in
     let a=Double(i)/512*2*Double.pi,f=c.data.fence
     return c.groundHeight(at:V2(f.centerX+cos(a)*f.radius,f.centerZ+sin(a)*f.radius))
   }
   data["terrain"]=terrain
   data["corridor"]=try JSONSerialization.jsonObject(with:Data(contentsOf:file.deletingPathExtension().appendingPathExtension("corridor")))
   try JSONSerialization.data(withJSONObject:data,options:[.sortedKeys]).write(to:output.appendingPathComponent(file.lastPathComponent))
  }
 }
}
