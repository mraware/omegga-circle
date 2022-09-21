class BuildingCircle {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    this.omegga
      .on('cmd:circle', this.circleStacking)
      .on('cmd:circleoutliner', this.circleOutliner)
      .on('cmd:oval', this.oval)

    return {
      registeredCommands: ['circle', 'circleoutliner', 'oval']
    };
  }

  unauthorized(senderName) {
    const player = this.omegga.getPlayer(senderName);
    if (
      this.config['only-authorized'] && !player.isHost() &&
      (
        (!this.config['authorized-users'] || !this.config['authorized-users'].some(p => player.id === p.id)) &&
        (!this.config['authorized-roles'] || !player.getRoles().some(role => this.config['authorized-roles'].includes(role)))
      )
    ) {
      this.omegga.whisper(senderName, '<color="ff0000">Unauthorized to use command.</>');
      return true;
    }
    return false;
  }

  // Fill holes for non-concave shapes
  optimize(bricks, fill, brickGenerated) {
    function combineBricks(first, last) {
      // same brick
      if (first.position[0] === last.position[0] && first.position[1] === last.position[1]) {
        return first
      }
      const { center, minBound, maxBound } = global.OMEGGA_UTIL.brick.getBounds({ brick_assets: [brickGenerated.type], bricks: [first, last] });
      const size = [Math.abs(minBound[0] - maxBound[0]) / 2, Math.abs(minBound[1] - maxBound[1]) / 2, Math.abs(minBound[2] - maxBound[2]) / 2]
      return {
        ...first,
        position: center,
        size
      }
    }

    function optimizeDirection(bricks, primary, secondary) {
      const newBricks = [];
      const sort = bricks.sort((left, right) => left.position[secondary] - right.position[secondary] || left.position[primary] - right.position[primary]);
      let first = sort[0];
      let last = sort[0];
      for (let i = 1; i < sort.length; i++) {
        const current = sort[i];
        if (
          first.size[secondary] === current.size[secondary] &&
          first.position[secondary] === current.position[secondary]
        ) {
          if (fill || (last.position[primary] + last.size[primary]) === (current.position[primary] - current.size[primary])) {
            last = current;
          } else {
            newBricks.push(combineBricks(first, last));
            first = current;
            last = current;
          }
        } else {
          newBricks.push(combineBricks(first, last));
          first = current;
          last = current;
        }
      }
      newBricks.push(combineBricks(first, last));

      return newBricks;
    }

    return optimizeDirection(optimizeDirection(bricks, 0, 1), 1, 0);
  }

  generateCircle = (radius, color, fill, brickGenerated) => {
    const bricks = [];

    function addBrick(x, y) {
      bricks.push({
        color,
        owner_index: 0,
        size: brickGenerated.size,
        position: [x * brickGenerated.size[0] * 2, y * brickGenerated.size[1] * 2, brickGenerated.size[2] * 2],
        material_index: 0,
        direction: 4,
        rotation: 0
      })
    }

    let x = 0;
    let y = radius;
    let d = -(radius >>> 1);

    while (x <= y) {
      if (x === 0) {
        addBrick(x, y);
        addBrick(y, x);
        addBrick(-y, x);
        addBrick(-x, -y);
      } else if (x === y) {
        addBrick(x, y);
        addBrick(-y, x);
        addBrick(-x, -y);
        addBrick(y, -x);
      } else {
        addBrick(x, y);
        addBrick(y, x);
        addBrick(-y, x);
        addBrick(-x, -y);
        addBrick(-x, y);
        addBrick(y, -x);
        addBrick(-y, -x);
        addBrick(x, -y);
      }


      if (d <= 0) {
        x++;
        d += x;
      } else {
        y--;
        d -= y;
      }
    }

    return this.optimize(bricks, fill, brickGenerated);
  }


  generateCircleOutliner = (radius, color, fill, brickGenerated) => {
    const bricks = [];

    function addBrick(x, y) {
      if (Object.is(x, -0) || Object.is(y, -0))
        return;
      bricks.push({
        color,
        owner_index: 0,
        size: brickGenerated.size,
        position: [x * brickGenerated.size[0] * 2, y * brickGenerated.size[1] * 2, brickGenerated.size[2] * 2],
        material_index: 0,
        direction: 4,
        rotation: 0
      })
    }

    let f = 1 - radius;
    let ddF_x = 0;
    let ddF_y = -2 * radius;
    let x = 0;
    let y = radius;

    addBrick(0, radius)
    addBrick(0, -radius)
    addBrick(radius, 0)
    addBrick(-radius, 0)

    while (x < y) {
      if (f >= 0) {
        y--;
        ddF_y += 2;
        f += ddF_y;
      }
      x++;
      ddF_x += 2;
      f += ddF_x + 1;

      if (y < x) {
        break;
      }

      addBrick(x, y);
      addBrick(-x, y);
      addBrick(x, -y);
      addBrick(-x, -y);

      if (x != y) {
        addBrick(y, x);
        addBrick(-y, x);
        addBrick(y, -x);
        addBrick(-y, -x);
      }
    }

    return this.optimize(bricks, fill, brickGenerated);
  }

  circleOutliner = async (senderName, radius, fill = 0) => {
    try {
      await this.circle(senderName, radius, this.generateCircleOutliner, fill)
    }
    catch (e) {
      console.log(e);
    }
  }

  circleStacking = async (senderName, radius, fill = 0) => {
    try {
      await this.circle(senderName, radius, this.generateCircle, fill)
    }
    catch (e) {
      console.log(e);
    }
  }

  circle = async (senderName, radius, generatorFunc, fill = 0) => {
    if (this.unauthorized(senderName)) return;
    if (radius) {
      const player = this.omegga.getPlayer(senderName);
      const nameColor = player.getNameColor();
      this.omegga.broadcast(`<b><color="${nameColor}">${senderName}</></> creating circle with radius ${radius}...`);
      const paint = await player.getPaint();
      const brickGenerated = await this.getGeneratedGhostBrick(player);

      if (!paint) {
        this.omegga.whisper(senderName, 'Select a paint color.');
        return;
      }
      if (!brickGenerated) {
        this.omegga.whisper(senderName, 'Missing ghost brick.');
        return;
      }

      let saveData = {
        version: 10,
        materials: [paint.material],
        brick_assets: [brickGenerated.type],
        bricks: generatorFunc(+radius, paint.color, +fill, brickGenerated)
      };


      // get bounds of the bricks
      const bounds = global.OMEGGA_UTIL.brick.getBounds(saveData);

      const orientation =
        global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.orientationMap[brickGenerated.orientation];
      saveData.bricks = saveData.bricks.map(brick =>
        global.OMEGGA_UTIL.brick.rotate(brick, orientation)
      );
      // rotate bounds, if we dont use the original bounds they are off by 1 sometimes >:(
      bounds.minBound = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.minBound);
      bounds.maxBound = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.maxBound);
      bounds.center = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.center);

      // calculate offset from bricks center to ghost brick center
      const offset = bounds.center.map(
        (center, index) => brickGenerated.location[index] - center
      );

      await player.loadSaveData(saveData, { offX: offset[0], offY: offset[1], offZ: offset[2] });
    } else {
      this.omegga.whisper(senderName, 'Must enter a radius');
    }
  }

  oval = async (senderName, x, y, fill = 0) => {
    try {
      if (this.unauthorized(senderName)) return;
      if (!x) {
        this.omegga.whisper(senderName, 'Missing width');
        return;
      }
      if (!y) {
        this.omegga.whisper(senderName, 'Missing height');
        return;
      }
      const player = this.omegga.getPlayer(senderName);
      const nameColor = player.getNameColor();
      this.omegga.broadcast(`<b><color="${nameColor}">${senderName}</></> creating oval with width ${x} and height ${y}...`);
      const paint = await player.getPaint();
      const brickGenerated = await this.getGeneratedGhostBrick(player);

      if (!paint) {
        this.omegga.whisper(senderName, 'Select a paint color.');
        return;
      }
      if (!brickGenerated) {
        this.omegga.whisper(senderName, 'Missing ghost brick.');
        return;
      }

      let saveData = {
        version: 10,
        materials: [paint.material],
        brick_assets: [brickGenerated.type],
        bricks: this.generateOval(+x / 2, +y / 2, paint.color, +fill, brickGenerated)
      };


      // get bounds of the bricks
      const bounds = global.OMEGGA_UTIL.brick.getBounds(saveData);

      const orientation =
        global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.orientationMap[brickGenerated.orientation];
      saveData.bricks = saveData.bricks.map(brick =>
        global.OMEGGA_UTIL.brick.rotate(brick, orientation)
      );
      // rotate bounds, if we dont use the original bounds they are off by 1 sometimes >:(
      bounds.minBound = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.minBound);
      bounds.maxBound = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.maxBound);
      bounds.center = global.OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        global.OMEGGA_UTIL.brick.d2o(...orientation)
      ](bounds.center);

      // calculate offset from bricks center to ghost brick center
      const offset = bounds.center.map(
        (center, index) => brickGenerated.location[index] - center
      );

      await player.loadSaveData(saveData, { offX: offset[0], offY: offset[1], offZ: offset[2] });
    }
    catch (e) {
      console.log(e)
    }

  }

  // getall BrickGridPreviewActor SimpleParameters
  // [2021.04.12-03.29.40:573][579]0) BrickGridPreviewActor /Game/Maps/Plate/Plate.Plate:PersistentLevel.BrickGridPreviewActor_2147482489.SimpleParameters = (BrickType=(BrickType=BrickTypeGenerated'"/Game/Bricks/Procedural/PB_DefaultBrick.PB_DefaultBrick:BrickTypeGenerated_2147482394"'),BrickColor=(B=255,G=255,R=255,A=255),MaterialAlpha=5,PreviewIgnoredBricks=)

  // GetAll BrickTypeGenerated HalfSize
  // [2021.04.12-03.51.37:292][ 65]0) BrickTypeGenerated /Game/Bricks/Procedural/PB_DefaultBrick.PB_DefaultBrick:BrickTypeGenerated_2147482394.HalfSize = (X=5,Y=5,Z=12)

  // BrickGridPreviewActor /Game/Maps/Plate/Plate.Plate:PersistentLevel.BrickGridPreviewActor_2147482509.TransformParameters = (TargetGrid="BrickGridComponent",Position=(X=285,Y=-365,Z=6),Orientation=Z_Positive_0)
  async getGeneratedGhostBrick({ controller }) {
    const ownerRegExp = /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.Owner = BP_PlayerController_C'(.+):PersistentLevel\.(?<controller>BP_PlayerController_C_\d+)'$/;
    const simpleParamsRegExp = /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.SimpleParameters = \(BrickType=\(.*(\.(?<brickType>.+):(?<brickTypeGenerated>.+)"'|None)\),BrickColor=\(B=(?<b>\d*),G=(?<g>\d*),R=(?<r>\d*),A=(?<a>\d*)\),PreviewIgnoredBricks=.*\)$/;
    const transformParamsRegExp = /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.TransformParameters = \(TargetGrid=("(?<targetGrid>.+)"|None),Position=\(X=(?<x>.+),Y=(?<y>.+),Z=(?<z>.+)\),Orientation=(?<orientation>.+)\)$/;
    const brickSizeRegExp = /^(?<index>\d+)\) BrickTypeGenerated .+:(?<actor>BrickTypeGenerated_\d+)\.HalfSize = \(X=(?<x>\d*),Y=(?<y>\d*),Z=(?<z>\d*)*\)$/;

    const [ownersMatch, simpleParametersMatch, transformParamsMatch] = await Promise.all([
      this.omegga.watchLogChunk('GetAll BrickGridPreviewActor Owner', ownerRegExp, { first: 'index', timeoutDelay: 2000, afterMatchDelay: 100 }),
      this.omegga.watchLogChunk('GetAll BrickGridPreviewActor SimpleParameters', simpleParamsRegExp, { first: 'index', timeoutDelay: 2000, afterMatchDelay: 100 }),
      this.omegga.watchLogChunk('GetAll BrickGridPreviewActor TransformParameters', transformParamsRegExp, { first: 'index', timeoutDelay: 2000, afterMatchDelay: 100 }),
    ]);


    // get BrickGridPreviewActor by controller
    const owner = ownersMatch.find((owner) => owner.groups.controller === controller);

    if (!owner)
      return;

    const actor = owner.groups.actor;
    // get transform parameters for the found actor
    const simpleParameters = simpleParametersMatch.find((simpleParameters) => simpleParameters.groups.actor === actor);

    if (!simpleParameters)
      return;

    const { brickType, brickTypeGenerated } = simpleParameters.groups;

    const transformParameters = transformParamsMatch.find(
      transformParameters => transformParameters.groups.actor === actor
    );

    if (!transformParameters) return;

    const brickSizeMatch = await this.omegga.watchLogChunk(`GetAll BrickTypeGenerated HalfSize Name=${brickTypeGenerated}`, brickSizeRegExp, { first: 'index', timeoutDelay: 500 })

    if (!brickSizeMatch || brickSizeMatch.length === 0)
      return;

    const brickSize = [+brickSizeMatch[0].groups.x, +brickSizeMatch[0].groups.y, +brickSizeMatch[0].groups.z];


    return {
      type: brickType,
      size: brickSize,
      location: [
        +transformParameters.groups.x,
        +transformParameters.groups.y,
        +transformParameters.groups.z,
      ],
      orientation: transformParameters.groups.orientation,
    }
  }

  // borrowed from https://www.geeksforgeeks.org/midpoint-ellipse-drawing-algorithm/ i'll give it back it's not stealing
  generateOval = (rx, ry, color, fill, brickGenerated) => {
    const bricks = [];

    function addBrick(x, y) {
      if (Object.is(x, -0) || Object.is(y, -0))
        return;
      bricks.push({
        color,
        owner_index: 0,
        size: brickGenerated.size,
        position: [x * brickGenerated.size[0] * 2, y * brickGenerated.size[1] * 2, brickGenerated.size[2] * 2],
        material_index: 0,
        direction: 4,
        rotation: 0
      })
    }

    var dx, dy, d1, d2, x, y;
    x = 0;
    y = ry;

    // Initial decision parameter of region 1
    d1 = (ry * ry) - (rx * rx * ry) +
      (0.25 * rx * rx);
    dx = 2 * ry * ry * x;
    dy = 2 * rx * rx * y;

    // For region 1
    while (dx < dy) {
      // add bricks based on 4-way symmetry
      addBrick(x, y)
      addBrick(-x, y)
      addBrick(x, -y)
      addBrick(-x, -y)

      // Checking and updating value of
      // decision parameter based on algorithm
      if (d1 < 0) {
        x++;
        dx = dx + (2 * ry * ry);
        d1 = d1 + dx + (ry * ry);
      }
      else {
        x++;
        y--;
        dx = dx + (2 * ry * ry);
        dy = dy - (2 * rx * rx);
        d1 = d1 + dx - dy + (ry * ry);
      }
    }

    // Decision parameter of region 2
    d2 = ((ry * ry) * ((x + 0.5) * (x + 0.5))) +
      ((rx * rx) * ((y - 1) * (y - 1))) -
      (rx * rx * ry * ry);

    // Plotting points of region 2
    while (y >= 0) {
      // add bricks based on 4-way symmetry
      addBrick(x, y)
      addBrick(-x, y)
      addBrick(x, -y)
      addBrick(-x, -y)


      // Checking and updating parameter
      // value based on algorithm
      if (d2 > 0) {
        y--;
        dy = dy - (2 * rx * rx);
        d2 = d2 + (rx * rx) - dy;
      }
      else {
        y--;
        x++;
        dx = dx + (2 * ry * ry);
        dy = dy - (2 * rx * rx);
        d2 = d2 + dx - dy + (rx * rx);
      }
    }

    return this.optimize(bricks, fill, brickGenerated);
  }


  stop() {
    this.omegga
      .removeAllListeners('cmd:circle')
      .removeAllListeners('cmd:circleoutliner')
      .removeAllListeners('cmd:oval')
  }
}

module.exports = BuildingCircle;