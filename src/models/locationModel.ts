import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Map } from './mapModel.js';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Map, (map) => map.id, { onDelete: 'CASCADE' }) // Relationship to Map
  map!: Map;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column()
  xCoordinate!: number; // X position on the map

  @Column()
  yCoordinate!: number; // Y position on the map
}
