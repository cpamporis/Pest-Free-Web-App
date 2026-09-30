import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView} from 'react-native';
import {ProtectedAdminModal} from './AdminSessionTimer';
import ProtectedImage from './ProtectedImage';

export default function SecureImageViewer({images=[],imageIndex=0,visible,onRequestClose}) {
  const [index,setIndex]=useState(imageIndex),[zoom,setZoom]=useState(1);
  const [size,setSize]=useState({width:600,height:500});
  useEffect(()=>{if(visible){setIndex(imageIndex);setZoom(1);}},[visible,imageIndex]);
  const move=next=>{if(next>=0&&next<images.length){setIndex(next);setZoom(1);}};
  const button=(label,action,disabled=false)=><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{padding:12,opacity:disabled ? 0.35 : 1}}><Text style={{color:'#fff',fontWeight:'600'}}>{label}</Text></TouchableOpacity>;
  return <ProtectedAdminModal visible={visible} transparent onRequestClose={onRequestClose}>
    <View style={{flex:1,backgroundColor:'rgba(0,0,0,.95)',padding:16}}>
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center'}}>
        {button('Προηγούμενη',()=>move(index-1),index===0)}
        {button('Σμίκρυνση −',()=>setZoom(v=>Math.max(1,v-.5)),zoom===1)}
        {button(`Μεγέθυνση + (${Math.round(zoom*100)}%)`,()=>setZoom(v=>Math.min(4,v+.5)),zoom===4)}
        {button('Επόμενη',()=>move(index+1),index>=images.length-1)}
        {button('Κλείσιμο',onRequestClose)}
      </View>
      <View style={{flex:1,overflow:'hidden'}} onLayout={e=>{const {width,height}=e.nativeEvent.layout;if(width&&height)setSize({width,height});}}>
        <ScrollView style={{flex:1}}><ScrollView horizontal>
          {images[index]&&<ProtectedImage source={images[index]} resizeMode="contain" style={{width:size.width*zoom,height:size.height*zoom}}/>}
        </ScrollView></ScrollView>
      </View>
    </View>
  </ProtectedAdminModal>;
}
