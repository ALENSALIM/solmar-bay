// Screenshot staging for Solmar Bay: with ?shot=title|driving|chase|combat
// the game arranges itself into that scene so screenshots are real renders
// of the running game, not composited images.
export function applyShot(G, name) {
  if (name === 'title') return; // Title screen over the orbiting city.
  G.startGame(false);
  const player = G.player;
  if (name === 'driving' || name === 'chase') {
    // Put Rico in a parked car on a straight road and drive.
    const car = G.traffic.nearestCar({ x: 0, z: 0 }, 400, true);
    if (car) {
      player.pos.set(car.pos.x + 2.5, 0, car.pos.z);
      player.tryEnterCar();
      player.carSpeed = 18;
      player.inCar.speed = 18;
      player.inCar.heading = 0;
      player.inCar.pos.set(-120, 0, -24);
      G.input.keys.add('KeyW');
    }
    if (name === 'chase') {
      G.police.setWanted(3);
    }
  } else if (name === 'combat') {
    // Rico on foot at the corner with the crew, pistol out, auto-firing.
    player.pos.set(G.city.cornerPos.x - 14, 0, G.city.cornerPos.z + 6);
    player.camYaw = Math.PI * 0.78;
    G.people.spawnEnemies([
      { x: G.city.cornerPos.x + 4, z: G.city.cornerPos.z - 4 },
      { x: G.city.cornerPos.x - 2, z: G.city.cornerPos.z - 8 },
      { x: G.city.cornerPos.x + 8, z: G.city.cornerPos.z + 2 },
    ]);
    G.autoFire = true;
  }
}
