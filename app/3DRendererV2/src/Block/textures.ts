import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

function loadTexture(path: string) {
  // TODO: make async
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = true;
  return texture;
}

export const textures = {
  grassSide: loadTexture("resource://mc/textures/blocks/grass_side_carried.png"),
  grassTop: loadTexture("resource://mc/textures/blocks/grass_carried.png"),
  dirt: loadTexture("resource://mc/textures/blocks/dirt.png"),
  stone: loadTexture("resource://mc/textures/blocks/stone.png"),
  coal: loadTexture("resource://mc/textures/blocks/coal_ore.png"),
  iron: loadTexture("resource://mc/textures/blocks/iron_ore.png"),
  bedrock: loadTexture("resource://mc/textures/blocks/bedrock.png"),
  oakLogSide: loadTexture("resource://mc/textures/blocks/log_oak.png"),
  oakLogTop: loadTexture("resource://mc/textures/blocks/log_oak_top.png"),
  leaves: loadTexture("resource://mc/textures/blocks/leaves_oak_carried.tga"),
  tallGrass: loadTexture("resource://mc/textures/blocks/tallgrass_carried.tga"),
  flowerRose: loadTexture("resource://mc/textures/blocks/flower_rose.png"),
  flowerDandelion: loadTexture("resource://mc/textures/blocks/flower_dandelion.png"),
  redstoneLamp: loadTexture("resource://mc/textures/blocks/redstone_lamp_on.png"),
  stoneBrick: loadTexture("resource://mc/textures/blocks/stonebrick.png"),
};

export const uiTextures = {
  grass: "textures/grass_block.png",
  dirt: "textures/dirt_block.png",
  stone: "textures/stone_block.png",
  coal: "textures/coal_block.png",
  iron: "textures/iron_block.png",
  bedrock: "textures/bedrock_block.png",
  oakLog: "textures/oak_log_block.png",
  leaves: "textures/leaves_block.png",
  tallGrass: "textures/tall_grass_block.png",
  flowerRose: "textures/flower_rose.png",
  flowerDandelion: "textures/flower_dandelion.png",
  redstoneLamp: "textures/redstone_lamp_block.png",
  stoneBrick: "textures/stonebrick_block.png",
};
