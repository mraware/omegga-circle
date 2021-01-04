class BuildingMirror {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;

    this.playerData = {};
  }

  async init() {
    this.omegga
      .on('cmd:mirror', this.mirror);
    
    return {
      registeredCommands: ['mirror']
    };
  }

  rotate(rotation, turns) {
    return (rotation + turns) % 4;
  }

  shouldResize(rotation, rot) {
    return (rot + rotation) % 2 === 1;
  }
  
  convertDirection({ direction, rotation, size }, axis, brickType) {
    const rotationType = rotationTypes[brickType];
    const map = axisMap[direction];
    let dir = direction;
    let rot = rotation;
    let scale = size;
    if (axis[map.axis]) {
      dir = map.directionFlip;
      if (rotationType === 1) {
        rot = this.rotate(rot, rot % 2 ? map.flip ? 0 : 2 : map.flip ? 2 : 0);
      } else if (rotationType === 2) {
        rot = this.rotate(rot, rot % 2 ? map.flip ? 1 : 3 : map.flip ? 3 : 1);
      } else if (rotationType === 3) {
        rot = this.rotate(rot, rot % 2 ? map.flip ? 3 : 1 : map.flip ? 1 : 3);
      } else if (rotationType === 4) {
        rot = this.rotate(rot, rot % 2 ? map.flip ? 2 : 0 : map.flip ? 0 : 2);
      }
    } 
    if (axis[map.turn1]) {
      if (rotationType === 1) {
        rot = this.rotate(rot, rot % 2 ? 2 : 0);
      } else if (rotationType === 2) {
        rot = this.rotate(rot, rot % 2 ? 3 : 1);
      } else if (rotationType === 3) {
        rot = this.rotate(rot, rot % 2 ? 1 : 3);
      } else if (rotationType === 4) {
        rot = this.rotate(rot, rot % 2 ? 0 : 2);
      }
      
    }
    if (axis[map.turn3]) {
      if (rotationType === 1) {
        rot = this.rotate(rot, rot % 2 ? 0 : 2);
      } else if (rotationType === 2) {
        rot = this.rotate(rot, rot % 2 ? 1 : 3);
      } else if (rotationType === 3) {
        rot = this.rotate(rot, rot % 2 ? 3 : 1);
      } else if (rotationType === 4) {
        rot = this.rotate(rot, rot % 2 ? 2 : 0);
      }
    }
    if (this.shouldResize(rotation, rot)) {
      scale = [size[1], size[0], size[2]];
    }
    return { direction: dir, rotation: rot, size: scale };
  }

  mirror = async (senderName, axisString) => {
    try {
      if (axisString) {
        let saveData = await this.omegga.getTemplateBoundsData(senderName);

        axisString = axisString.toLowerCase();
        const axis = [axisString.includes('x'), axisString.includes('y'), axisString.includes('z')];

        const { maxBound } = global.OMEGGA_UTIL.getBounds(saveData.bricks);

        saveData.bricks = saveData.bricks.map((brick) => {
          const { direction, rotation, size } = this.convertDirection(brick, axis, saveData.brick_assets[brick.asset_name_index]);
          return {
            ...brick,
            position: brick.position.map((val, index) => (axis[index] ? maxBound[index] - val : val)),
            direction,
            rotation,
            size
          };
        });
        saveData = this.omegga.setOwnership(senderName, saveData);
        await this.omegga.loadDataAtGhostBrick(senderName, saveData);
      } else {
        // tell user to add axis
      }
    } catch(error) {
      console.log(error);
    }
  }

  stop() {
    this.omegga
      .removeListener('cmd:mirror', this.mirror);
  }
}

const rotationTypes = {
  PB_DefaultBrick: 1,
  PB_DefaultRamp: 1,
  PB_DefaultRampCrest: 1,
  PB_DefaultRampCrestCorner: 2,
  PB_DefaultRampCrestEnd: 4,
  PB_DefaultRampInnerCorner: 3,
  PB_DefaultRampInnerCornerInverted: 3,
  PB_DefaultRampInverted: 1,
  PB_DefaultRampCorner: 3,
  PB_DefaultRampCornerInverted: 3,
  PB_DefaultSideWedge: 3,
  PB_DefaultTile: 1,
  PB_DefaultWedge: 1,
  PB_DefaultSideWedgeTile: 3,
  // TODO add these bricks
  PB_DefaultMicroBrick: 1,
  PB_DefaultMicroWedgeCorner: 3,
  PB_DefaultMicroWedgeInnerCorner: 3,
  PB_DefaultMicroWedgeOuterCorner: 3,
  PB_DefaultMicroWedgeTriangleCorner: 3,
  PB_DefaultMicroWedge: 3,
  PB_DefaultStudded: 1,
  // end TODO
  B_1x1_Brick_Side: 4,
  B_1x1_Brick_Side_Lip: 1,
  B_1x1_Cone: 0,
  B_1x1_Round: 0,
  B_1x1F_Octo: 1,
  B_1x1F_Round: 0,
  B_1x2_Overhang: 1,
  B_1x2f_Plate_Center: 1,
  B_1x2f_Plate_Center_Inv: 1,
  B_1x4_Brick_Side: 4,
  B_1x_Octo: 1,
  B_1x_Octo_90Deg: 4,
  B_1x_Octo_90Deg_Inv: 4,
  B_1x_Octo_T: 4,
  B_1x_Octo_T_Inv: 4,
  B_2x1_Slipper: 1,
  B_2x2_Cone: 0,
  B_2x2_Corner: 3,
  B_2x2_Overhang: 1,
  B_2x2_Round: 0,
  B_2x2_Slipper: 1,
  B_2x2F_Octo: 1,
  B_2x2F_Octo_Converter: 1,
  B_2x2F_Octo_Converter_Inv: 1,
  B_2x2f_Plate_Center: 1,
  B_2x2f_Plate_Center_Inv: 1,
  B_2x2F_Round: 0,
  B_2x4_Door_Frame: 1,
  B_2x_Cube_Side: 0,
  B_2x_Octo: 1,
  B_2x_Octo_90Deg: 4,
  B_2x_Octo_90Deg_Inv: 4,
  B_2x_Octo_Cone: 0,
  B_2x_Octo_T: 4,
  B_2x_Octo_T_Inv: 4,
  B_4x4_Round: 0,
  B_8x8_Lattice_Plate: 0,
  B_Bishop: 0,
  B_Bone: 2,
  B_BoneStraight: 1,
  B_Branch: 1,
  B_Bush: 0,
  B_Cauldron: 0,
  B_Chalice: 0,
  B_CheckPoint: 1,
  B_Coffin: 1,
  B_Leaf_Bush: 1,
  B_Coffin_Lid: 1,
  B_Fern: 2,
  B_Flame: 0,
  B_Flower: 0,
  B_Gravestone: 0,
  B_GoalPoint: 1,
  B_Handle: 1,
  B_Hedge_1x1: 1,
  B_Hedge_1x1_Corner: 3,
  B_Hedge_1x2: 1,
  B_Hedge_1x4: 1,
  B_Inverted_Cone: 0,
  B_Jar: 0,
  B_King: 4,
  B_Knight: 4,
  B_Ladder: 1,
  B_Pawn: 0,
  B_Picket_Fence: 1,
  B_Pine_Tree: 0,
  B_Pumpkin: 4,
  B_Pumpkin_Carved: 4,
  B_Queen: 4,
  B_Rook: 4,
  B_Sausage: 1,
  B_Small_Flower: 0,
  B_SpawnPoint: 1,
  B_Swirl_Plate: 1,
  B_Turkey_Body: 1,
  B_Turkey_Leg: 1,
};

const axisMap = {
  0: {
    axis: 0,
    flip: false,
    turn1: 1,
    turn3: 2,
    directionFlip: 1
  },
  1: {
    axis: 0,
    flip: false,
    turn1: 1,
    turn3: 2,
    directionFlip: 0
  },
  2: {
    axis: 1,
    flip: false,
    turn1: 0,
    turn3: 2,
    directionFlip: 3
  },
  3: {
    axis: 1,
    flip: false,
    turn1: 0,
    turn3: 2,
    directionFlip: 2
  },
  4: {
    axis: 2,
    flip: true,
    turn1: 1,
    turn3: 0,
    directionFlip: 5
  },
  5: {
    axis: 2,
    flip: true,
    turn1: 1,
    turn3: 0,
    directionFlip: 4
  },
};


module.exports = BuildingMirror;