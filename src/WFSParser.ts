import { Feature, Geometry, Position } from "geojson";
import {xml2json, xml2js} from "xml-js"
import { FeatureMemberEntity, WFSFeatureCollection } from "./WFSFeatureCollection";
export type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

/**
 * Assumes GML version 3.1.1.
 */
export class WFSParser{
  /**
   * @param wfsXML A raw string of WFS GetFeatureRequest that contains "wfs:FeatureCollection" attribute.
   * @returns A GeoJSON FeatureCollection for the WFS feature collection.
   */
  static convertFeatureCollection2GeoJSON(wfsXML: string){
    function convertWFSFeatureCollection2JSON(){
      const parseOptions = {
        compact: true,
        space: 0,
        elementNameFn: (eleName: string) => {
          // Replace all the WFS prefixes (eg: "wfs:", "gml:") fron attributes.
          return eleName.replace(/^(.+?):/i, "")
        },
      };
      let featureCollection = xml2js(wfsXML, parseOptions);
      return featureCollection;
    }
    const featureCollection = <WFSFeatureCollection>convertWFSFeatureCollection2JSON();

    function convertFeatureCollection2GeoJSON(featureCollection: WFSFeatureCollection){
      if (!featureCollection["FeatureCollection"]){
        throw `This WFS string does not contain "wfs:FeatureCollection" attribute as the outer most container. You're possibly trying to convert other WFS format that is not FeatureCollection.`
      }
      let geoJSON: GeoJSONFeatureCollection = {type:"FeatureCollection", features: []}
      // Parse each feature
      const features_WFS = featureCollection.FeatureCollection.featureMember;
      if (!features_WFS){
        throw 'WFS string does not contain "featureMember" attribute.'
      }
      const features_GEO = features_WFS.map((feature_WFS: any, i)=>{
        // Get the first key, and get its object which contains geometries and properties for GeoJSON.
        const featureAttrs_WFS = feature_WFS[Object.keys(feature_WFS)[0]];

        // Parse the geometry attribute.
        // https://datatracker.ietf.org/doc/html/rfc7946#section-1.4
        //    geometry.type attribute in GeoJSON must be one of 
        //    "Point", "MultiPoint", "LineString","MultiLineString", "Polygon", "MultiPolygon", and "GeometryCollection"
        //    This script assumes that the values are separated by commas and do not have the outer most brackets "[ ]"
        //    To accomodate the different format, it also creates a string attribute for raw value.
        const geometryTypeName_WFS = Object.keys(featureAttrs_WFS["Shape"])[0]; //eg) Point
        
        const geometry_WFS = featureAttrs_WFS["Shape"][geometryTypeName_WFS];
        let geometry_Geo = {
          // First key name of the Shape object is the type name. (eg: Point)
          type: <Geometry["type"]>(Object.keys(featureAttrs_WFS["Shape"])[0] as unknown),
          coordinates: [] as Position[],
          geometries: [] as any, // It can potentially have Geometry[], but this library just returns a original string, if values exists.
        }
        if (geometry_WFS){
          // This JSON parsing assumes that the original value in the XML tag is a comma separated value.
          // It could fail or add extra layer of array if the value is Polygon array etc
          // e.g) <coordinates>6.6103,46.9838</coordinates> ---> Works!
          //      <coordinates>[6.6103,46.9838]</coordinates> ---> Adds unnecessary outer array.
          geometry_Geo.coordinates = geometry_WFS.coordinates? JSON.parse(`[${geometry_WFS.coordinates._text}]`):null;
          geometry_Geo.geometries = geometry_WFS.geometries?? null;
        }

        // Parse the properties attribute from the raw object.
        // Get every attribute from featureAttrs_WFS, except for Shape attribute, which was used for extracting geometry above.
        const {Shape, ...properties_WFS} = featureAttrs_WFS;
        // At this point, some of the attributes' value in properties_WFS is stored as an object under the "_text" atttribute like
        // e.g) <name>Passo del Bernina</name> {_text: "Passo del Bernina"}
        // So we want to just extract the text value.
        for (let attr in properties_WFS){
          const obj = properties_WFS[attr];
          if ("_text" in obj){
            properties_WFS[attr] = obj["_text"];
          }
        }
        const properties_Geo = {...properties_WFS};

        return {
          type: "Feature",
          geometry: geometry_Geo,
          properties: properties_Geo
        }
      });
      return {...geoJSON, features: features_GEO};
    }
    const geoJSONFeatureCollection = convertFeatureCollection2GeoJSON(featureCollection);    
    return geoJSONFeatureCollection;
  }
}