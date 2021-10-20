
import { readFile, writeFile } from "fs";
import { WFSParser } from "./WFSParser";

readFile("/Users/amon/workspace/wfs-to-geojson-converter/src/files/station-wfs.xml", (err: any, data:any)=>{
  if (err){
    throw err;
  }
  const xml = data.toString();
  const json = WFSParser.convertFeatureCollection2GeoJSON(xml);
  writeFile("/Users/amon/workspace/wfs-to-geojson-converter/src/output/output.json", JSON.stringify(json), (err)=>{console.log(err)});
})